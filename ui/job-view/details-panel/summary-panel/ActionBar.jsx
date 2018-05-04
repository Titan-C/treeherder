import React from 'react';
import PropTypes from 'prop-types';
import { Queue, slugid } from 'taskcluster-client-web';
import $ from 'jquery';
import jsyaml from 'js-yaml';

import thTaskcluster from '../../../js/services/taskcluster';
import { thEvents } from '../../../js/constants';
import { withPinBoard } from '../../../context/PinBoardContext';
import { with$injector } from '../../../context/InjectorContext';
import { isReftest } from '../../../helpers/jobHelper';
import { getInspectTaskUrl, getReftestUrl } from '../../../helpers/urlHelper';
import { withUser } from '../../../context/UserContext';
import tcJobActionsTemplate from '../../../partials/main/tcjobactions.html';

class ActionBar extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.ThJobModel = $injector.get('ThJobModel');
    this.ThJobDetailModel = $injector.get('ThJobDetailModel');
    this.thBuildApi = $injector.get('thBuildApi');
    this.ThModelErrors = $injector.get('ThModelErrors');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.tcactions = $injector.get('tcactions');
    this.ThTaskclusterErrors = $injector.get('ThTaskclusterErrors');
    this.$interpolate = $injector.get('$interpolate');
    this.$uibModal = $injector.get('$uibModal');

    this.state = {

    };
  }

  componentDidMount() {
    const { logParseStatus } = this.props;

    // Open the logviewer and provide notifications if it isn't available
    this.$rootScope.$on(thEvents.openLogviewer, () => {
      switch (logParseStatus) {
        case 'pending':
          this.thNotify.send("Log parsing in progress, log viewer not yet available", 'info'); break;
        case 'failed':
          this.thNotify.send("Log parsing has failed, log viewer is unavailable", 'warning'); break;
        case 'unavailable':
          this.thNotify.send("No logs available for this job", 'info'); break;
        case 'parsed':
          $('#logviewer-btn')[0].click();
      }
    });

    this.$rootScope.$on(thEvents.jobRetrigger, function (event, job) {
        this.retriggerJob([job]);
    });


  }

  componentWillUnmount() {

  }

  canCancel() {
    const { selectedJob } = this.props;
    return selectedJob.state === "pending" || selectedJob.state === "running";
  }

  retriggerJob(jobs) {
    const { user, repoName } = this.props;

    if (user.isLoggedIn) {
        // Spin the retrigger button when retriggers happen
        $("#retrigger-btn > span").removeClass("action-bar-spin");
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                $("#retrigger-btn > span").addClass("action-bar-spin");
            });
        });

        const job_id_list = jobs.map(job => job.id);
        // The logic here is somewhat complicated because we need to support
        // two use cases the first is the case where we notify a system other
        // then buildbot that a retrigger has been requested (eg mozilla-taskcluster).
        // The second is when we have the buildapi id and need to send a request
        // to the self serve api (which does not listen over pulse!).
        this.ThJobModel.retrigger(repoName, job_id_list).then(() => (
            this.ThJobDetailModel.getJobDetails({
                title: "buildbot_request_id",
                repository: repoName,
                job_id__in: job_id_list.join(',') })
            .then((data) => {
                const requestIdList = data.map(datum => datum.value);
                requestIdList.forEach((requestId) => {
                    this.thBuildApi.retriggerJob(repoName, requestId);
                });
            })
        ).then(() => {
            this.thNotify.send("Retrigger request sent", "success");
        }, (e) => {
            // Generic error eg. the user doesn't have LDAP access
            this.thNotify.send(
                this.ThModelErrors.format(e, "Unable to send retrigger"), 'danger');
        }));
    } else {
        this.thNotify.send("Must be logged in to retrigger a job", 'danger');
    }
  }

  backfillJob() {
    const { user, selectedJob, repoName } = this.props;

    if (!this.canBackfill()) {
      return;
    }
    if (!user.isLoggedIn) {
      this.thNotify.send("Must be logged in to backfill a job", 'danger');
      return;
    }
    if (!selectedJob.id) {
      this.thNotify.send("Job not yet loaded for backfill", 'warning');
      return;
    }

    if (selectedJob.build_system_type === 'taskcluster' || selectedJob.reason.startsWith('Created by BBB for task')) {
      this.ThResultSetStore.getGeckoDecisionTaskId(
        selectedJob.result_set_id).then(function (decisionTaskId) {
        return this.tcactions.load(decisionTaskId, selectedJob).then((results) => {
          const actionTaskId = slugid();
          if (results) {
            const backfilltask = results.actions.find(result => result.name === 'backfill');
            // We'll fall back to actions.yaml if this isn't true
            if (backfilltask) {
              return this.tcactions.submit({
                action: backfilltask,
                actionTaskId,
                decisionTaskId,
                taskId: results.originalTaskId,
                task: results.originalTask,
                input: {},
                staticActionVariables: results.staticActionVariables,
              }).then(() => {
                this.$timeout(() => this.thNotify.send(
                  `Request sent to backfill job via actions.json (${actionTaskId})`,
                  'success')
                );
              }, (e) => {
                // The full message is too large to fit in a Treeherder
                // notification box.
                this.$timeout(() => this.thNotify.send(
                  this.ThTaskclusterErrors.format(e),
                  'danger',
                  { sticky: true })
                );
              });
            }
          }

          // Otherwise we'll figure things out with actions.yml
          const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });

          // buildUrl is documented at
          // https://github.com/taskcluster/taskcluster-client-web#construct-urls
          // It is necessary here because getLatestArtifact assumes it is getting back
          // JSON as a reponse due to how the client library is constructed. Since this
          // result is yml, we'll fetch it manually using $http and can use the url
          // returned by this method.
          const url = queue.buildUrl(
            queue.getLatestArtifact,
            decisionTaskId,
            'public/action.yml'
          );
          fetch(url).then((resp) => {
            let action = resp.data;
            console.log(action);

            const template = this.$interpolate(action);
            action = template({
              action: 'backfill',
              action_args: `--project=${repoName}' --job=${selectedJob.id}`,
            });

            const task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
            queue.createTask(actionTaskId, task).then(function () {
              this.$timeout(() => this.thNotify.send(
                `Request sent to backfill job via actions.yml (${actionTaskId})`,
                'success')
              );
            }, (e) => {
              // The full message is too large to fit in a Treeherder
              // notification box.
              this.$timeout(() => this.thNotify.send(
                this.ThTaskclusterErrors.format(e),
                'danger',
                { sticky: true })
              );
            });
          });
        });
      });
    } else {
      this.thNotify.send('Unable to backfill this job type!', 'danger', { sticky: true });
    }
  }

  // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
  canBackfill() {
    const { user, isTryRepo } = this.props;

    return user.isLoggedIn && !isTryRepo;
  }

  backfillButtonTitle() {
    const { user, isTryRepo } = this.props;
    let title = "";

    if (!user.isLoggedIn) {
      title = title.concat("must be logged in to backfill a job / ");
    }

    if (isTryRepo) {
      title = title.concat("backfill not available in this repository");
    }

    if (title === "") {
      title = "Trigger jobs of ths type on prior pushes " +
        "to fill in gaps where the job was not run";
    } else {
      // Cut off trailing "/ " if one exists, capitalize first letter
      title = title.replace(/\/ $/, "");
      title = title.replace(/^./, l => l.toUpperCase());
    }
    return title;
  }

  cancelJobs(jobs) {
    const { repoName } = this.props;
    const jobIdsToCancel = jobs.filter(job => (job.state === "pending" ||
      job.state === "running")).map(
      job => job.id);
    // get buildbot ids of any buildbot jobs we want to cancel
    // first
    this.ThJobDetailModel.getJobDetails({
                                          job_id__in: jobIdsToCancel,
                                          title: 'buildbot_request_id'
                                        }).then(buildbotRequestIdDetails => (
      this.ThJobModel.cancel(repoName, jobIdsToCancel).then(
        () => {
          buildbotRequestIdDetails.forEach(
            (buildbotRequestIdDetail) => {
              const requestId = parseInt(buildbotRequestIdDetail.value);
              this.thBuildApi.cancelJob(repoName, requestId);
            });
        })
    )).then(() => {
      this.thNotify.send("Cancel request sent", "success");
    }).catch(function (e) {
      this.thNotify.send(
        this.ThModelErrors.format(e, "Unable to cancel job"),
        "danger",
        { sticky: true }
      );
    });
  }

  cancelJob() {
    this.cancelJobs([this.props.selectedJob]);
  }

  customJobAction() {
    const { repoName, selectedJob } = this.props;

    this.$uibModal.open({
      template: tcJobActionsTemplate,
      controller: 'TCJobActionsCtrl',
      size: 'lg',
      resolve: {
        job: () => selectedJob,
        repoName: () => repoName,
        resultsetId: () => selectedJob.result_set_id
      }
    });
  }

  render() {
    const { selectedJob, pinBoard, lvUrl, lvFullUrl, jobLogUrls, user } = this.props;

    return (
      <div id="job-details-actionbar">
        <nav className="navbar navbar-dark info-panel-navbar">
          <ul className="nav navbar-nav actionbar-nav">

            {jobLogUrls.map(jobLogUrl => (<li>
              {jobLogUrl.parse_status === 'parsed' && <a
                id="logviewer-btn"
                title="Open the log viewer in a new window"
                target="_blank"
                rel="noopener"
                href={lvUrl}
                copy-value={lvFullUrl}
                className=""
              >
                <img
                  alt="Logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>}
              {jobLogUrl.parse_status === 'failed' && <a
                id="logviewer-btn"
                title="Log parsing has failed"
                className="disabled"
              >
                <img
                  alt="logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>}
              {jobLogUrl.parse_status === 'pending' && <a
                id="logviewer-btn"
                className="disabled"
                title="Log parsing in progress"
              >
                <img
                  alt="logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>}
            </li>))}
            <li>
              {!jobLogUrls.length && <a
                id="logviewer-btn"
                className="disabled"
                title="No logs available for this job"
              >
                <img
                  alt="Logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>}
            </li>

            {jobLogUrls.map(jobLogUrl => (<li>
              <a
                id="raw-log-btn"
                className="raw-log-icon"
                title="Open the raw log in a new window"
                target="_blank"
                rel="noopener"
                href={jobLogUrl.url}
                copy-value={jobLogUrl.url}
              ><span className="fa fa-file-text-o" /></a>
            </li>))}
            {!jobLogUrls.length && <li>
              <a
                className="disabled raw-log-icon"
                title="No logs available for this job"
              ><span className="fa fa-file-text-o" /></a>
            </li>}
            <li>
              <span
                id="pin-job-btn"
                title="Add this job to the pinboard"
                className="btn icon-blue"
                onClick={() => pinBoard.pinJob(selectedJob)}
              ><span className="fa fa-thumb-tack" /></span>
            </li>
            <li>
              <span
                id="retrigger-btn"
                title={user.isLoggedIn ? 'Repeat the selected job' : 'Must be logged in to retrigger a job'}
                className={`btn ${user.isLoggedIn ? 'icon-green' : 'disabled'}`}
                disabled={!user.isLoggedIn}
                onClick={() => this.retriggerJob([selectedJob])}
              ><span className="fa fa-repeat" /></span>
            </li>
            {isReftest(selectedJob) && jobLogUrls.map(jobLogUrl => (<li>
              <a
                title="Launch the Reftest Analyser in a new window"
                target="_blank"
                rel="noopener"
                href={getReftestUrl(jobLogUrl)}
              ><span className="fa fa-bar-chart-o" /></a>
            </li>))}
            {this.canCancel() && <li>
              <a
                title={user.isLoggedIn ? 'Cancel this job' : 'Must be logged in to cancel a job'}
                className={user.isLoggedIn ? 'hover-warning' : 'disabled'}
                href=""
                onClick={() => this.cancelJob()}
              ><span className="fa fa-times-circle cancel-job-icon" /></a>
            </li>}
          </ul>
          <ul className="nav navbar-right">
            <li className="dropdown">
              <span
                id="actionbar-menu-btn"
                title="Other job actions"
                aria-haspopup="true"
                aria-expanded="false"
                className="dropdown-toggle"
                type="button"
                data-toggle="dropdown"
              ><span className="fa fa-ellipsis-h" aria-hidden="true" /></span>
              <ul className="dropdown-menu actionbar-menu" role="menu">
                <li>
                  <span
                    id="backfill-btn"
                    className={`btn dropdown-item ${!user.isLoggedIn || !this.canBackfill() ? 'disabled' : ''}`}
                    title={this.backfillButtonTitle()}
                    disabled={!this.canBackfill()}
                    onClick={() => !this.canBackfill() || this.backfillJob()}
                  >Backfill</span>
                </li>
                {selectedJob.taskcluster_metadata && <React.Fragment>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener"
                      className="dropdown-item"
                      href={this.getInspectTaskUrl(selectedJob.taskcluster_metadata.task_id)}
                    >Inspect Task</a>
                  </li>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener"
                      className="dropdown-item"
                      href={`${getInspectTaskUrl(selectedJob.taskcluster_metadata.task_id)}/create`}
                    >Edit and Retrigger</a>
                  </li>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener"
                      className="dropdown-item"
                      href={`https://tools.taskcluster.net/tasks/${selectedJob.taskcluster_metadata.task_id}/interactive`}
                    >Create Interactive Task</a>
                  </li>
                  <li>
                    <a
                      onClick={this.customJobAction()}
                      className="dropdown-item"
                    >Custom Action...</a>
                  </li>
                </React.Fragment>}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    );
  }
}

ActionBar.propTypes = {
  $injector: PropTypes.object.isRequired,
  pinBoard: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.object.isRequired,
  logParseStatus: PropTypes.string.isRequired,
  jobLogUrls: PropTypes.array,
  isTryRepo: PropTypes.bool,
  lvUrl: PropTypes.object,
  lvFullUrl: PropTypes.object,
};

ActionBar.defaultProps = {
  isTryRepo: true, // default to more restrictive for backfilling
  lvUrl: null,
  lvFullUrl: null,
  jobLogUrls: [],
};

export default withPinBoard(with$injector(withUser(ActionBar)));
