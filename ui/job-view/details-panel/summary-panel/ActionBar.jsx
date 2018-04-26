import React from 'react';
import { Queue, slugid } from 'taskcluster-client-web';
import jsyaml from 'js-yaml';

import { isReftest } from '../../../helpers/jobHelper';
import thTaskcluster from '../../../js/services/taskcluster';
import { thEvents } from '../../../js/constants';

export default class ActionBar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {

    };
  }

  componentDidMount() {
          // Open the logviewer and provide notifications if it isn't available
        // $rootScope.$on(thEvents.openLogviewer, function () {
        //     if ($scope.logParseStatus === 'pending') {
        //         thNotify.send("Log parsing in progress, log viewer not yet available", 'info');
        //     } else if ($scope.logParseStatus === 'failed') {
        //         thNotify.send("Log parsing has failed, log viewer is unavailable", 'warning');
        //     } else if ($scope.logParseStatus === 'unavailable') {
        //         thNotify.send("No logs available for this job", 'info');
        //     // If it's available open the logviewer
        //     } else if ($scope.logParseStatus === 'parsed') {
        //         $('#logviewer-btn')[0].click();
        //     }
        // });
        //
        // $rootScope.$on(thEvents.jobRetrigger, function (event, job) {
        //     $scope.retriggerJob([job]);
        // });


  }

  componentWillUnmount() {

  }

  canCancel() {
      return $scope.job &&
             ($scope.job.state === "pending" || $scope.job.state === "running");
  }

  // retriggerJob(jobs) {
  //     if ($scope.user.isLoggedIn) {
  //         // Spin the retrigger button when retriggers happen
  //         $("#retrigger-btn > span").removeClass("action-bar-spin");
  //         window.requestAnimationFrame(function () {
  //             window.requestAnimationFrame(function () {
  //                 $("#retrigger-btn > span").addClass("action-bar-spin");
  //             });
  //         });
  //
  //         const job_id_list = _.map(jobs, 'id');
  //         // The logic here is somewhat complicated because we need to support
  //         // two use cases the first is the case where we notify a system other
  //         // then buildbot that a retrigger has been requested (eg mozilla-taskcluster).
  //         // The second is when we have the buildapi id and need to send a request
  //         // to the self serve api (which does not listen over pulse!).
  //         ThJobModel.retrigger($scope.repoName, job_id_list).then(function () {
  //             return ThJobDetailModel.getJobDetails({
  //                 title: "buildbot_request_id",
  //                 repository: $scope.repoName,
  //                 job_id__in: job_id_list.join(',')
  //             }).then(function (data) {
  //                 const requestIdList = _.map(data, 'value');
  //                 requestIdList.forEach(function (requestId) {
  //                     thBuildApi.retriggerJob($scope.repoName, requestId);
  //                 });
  //             });
  //         }).then(function () {
  //             thNotify.send("Retrigger request sent", "success");
  //         }, function (e) {
  //             // Generic error eg. the user doesn't have LDAP access
  //             thNotify.send(
  //                 ThModelErrors.format(e, "Unable to send retrigger"), 'danger');
  //         });
  //     } else {
  //         thNotify.send("Must be logged in to retrigger a job", 'danger');
  //     }
  // };
  //
  // backfillJob() {
  //     if (!$scope.canBackfill()) {
  //         return;
  //     }
  //     if (!$scope.user.isLoggedIn) {
  //         thNotify.send("Must be logged in to backfill a job", 'danger');
  //         return;
  //     }
  //     if (!$scope.job.id) {
  //         thNotify.send("Job not yet loaded for backfill", 'warning');
  //         return;
  //     }
  //
  //     if ($scope.job.build_system_type === 'taskcluster' || $scope.job.reason.startsWith('Created by BBB for task')) {
  //         ThResultSetStore.getGeckoDecisionTaskId(
  //             $scope.resultsetId).then(function (decisionTaskId) {
  //                 return tcactions.load(decisionTaskId, $scope.job).then((results) => {
  //                     const actionTaskId = slugid();
  //                     if (results) {
  //                         const backfilltask = _.find(results.actions, { name: 'backfill' });
  //                         // We'll fall back to actions.yaml if this isn't true
  //                         if (backfilltask) {
  //                             return tcactions.submit({
  //                                 action: backfilltask,
  //                                 actionTaskId,
  //                                 decisionTaskId,
  //                                 taskId: results.originalTaskId,
  //                                 task: results.originalTask,
  //                                 input: {},
  //                                 staticActionVariables: results.staticActionVariables,
  //                             }).then(function () {
  //                                 $scope.$apply(thNotify.send(`Request sent to backfill job via actions.json (${actionTaskId})`, 'success'));
  //                             }, function (e) {
  //                                 // The full message is too large to fit in a Treeherder
  //                                 // notification box.
  //                                 $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true }));
  //                             });
  //                         }
  //                     }
  //
  //                     // Otherwise we'll figure things out with actions.yml
  //                     const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });
  //
  //                     // buildUrl is documented at
  //                     // https://github.com/taskcluster/taskcluster-client-web#construct-urls
  //                     // It is necessary here because getLatestArtifact assumes it is getting back
  //                     // JSON as a reponse due to how the client library is constructed. Since this
  //                     // result is yml, we'll fetch it manually using $http and can use the url
  //                     // returned by this method.
  //                     const url = queue.buildUrl(
  //                         queue.getLatestArtifact,
  //                         decisionTaskId,
  //                         'public/action.yml'
  //                     );
  //                     $http.get(url).then(function (resp) {
  //                         let action = resp.data;
  //                         const template = $interpolate(action);
  //                         action = template({
  //                             action: 'backfill',
  //                             action_args: '--project=' + $scope.repoName + ' --job=' + $scope.job.id,
  //                         });
  //
  //                         const task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
  //                         queue.createTask(actionTaskId, task).then(function () {
  //                             $scope.$apply(thNotify.send(`Request sent to backfill job via actions.yml (${actionTaskId})`, 'success'));
  //                         }, function (e) {
  //                             // The full message is too large to fit in a Treeherder
  //                             // notification box.
  //                             $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true }));
  //                         });
  //                     });
  //                 });
  //             });
  //     } else {
  //         thNotify.send('Unable to backfill this job type!', 'danger', { sticky: true });
  //     }
  // }
  //
  // // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
  // canBackfill() {
  //     return $scope.user.isLoggedIn && $scope.currentRepo &&
  //            !$scope.currentRepo.is_try_repo;
  // };
  //
  // backfillButtonTitle() {
  //     let title = "";
  //
  //     // Ensure currentRepo is available on initial page load
  //     if (!$scope.currentRepo) {
  //         // still loading
  //         return undefined;
  //     }
  //
  //     if (!$scope.user.isLoggedIn) {
  //         title = title.concat("must be logged in to backfill a job / ");
  //     }
  //
  //     if ($scope.currentRepo.is_try_repo) {
  //         title = title.concat("backfill not available in this repository");
  //     }
  //
  //     if (title === "") {
  //         title = "Trigger jobs of ths type on prior pushes " +
  //                 "to fill in gaps where the job was not run";
  //     } else {
  //         // Cut off trailing "/ " if one exists, capitalize first letter
  //         title = title.replace(/\/ $/, "");
  //         title = title.replace(/^./, l => l.toUpperCase());
  //     }
  //     return title;
  // }
  //
  // cancelJobs(jobs) {
  //     const jobIdsToCancel = jobs.filter(job => (job.state === "pending" ||
  //                                              job.state === "running")).map(
  //                                                  job => job.id);
  //     // get buildbot ids of any buildbot jobs we want to cancel
  //     // first
  //     ThJobDetailModel.getJobDetails({
  //         job_id__in: jobIdsToCancel,
  //         title: 'buildbot_request_id'
  //     }).then(function (buildbotRequestIdDetails) {
  //         return ThJobModel.cancel($scope.repoName, jobIdsToCancel).then(
  //             function () {
  //                 buildbotRequestIdDetails.forEach(
  //                     function (buildbotRequestIdDetail) {
  //                         const requestId = parseInt(buildbotRequestIdDetail.value);
  //                         thBuildApi.cancelJob($scope.repoName, requestId);
  //                     });
  //             });
  //     }).then(function () {
  //         thNotify.send("Cancel request sent", "success");
  //     }).catch(function (e) {
  //         thNotify.send(
  //             ThModelErrors.format(e, "Unable to cancel job"),
  //             "danger",
  //             { sticky: true }
  //         );
  //     });
  // }
  //
  // cancelJob() {
  //     $scope.cancelJobs([$scope.job]);
  // };
  //
  // customJobAction() {
  //     $uibModal.open({
  //         template: tcJobActionsTemplate,
  //         controller: 'TCJobActionsCtrl',
  //         size: 'lg',
  //         resolve: {
  //             job: function () {
  //                 return $scope.job;
  //             },
  //             repoName: function () {
  //                 return $scope.repoName;
  //             },
  //             resultsetId: function () {
  //                 return $scope.resultsetId;
  //             }
  //         }
  //     });
  // }

  // Test to expose the reftest button in the job details navbar
  isReftest() {
      if ($scope.selectedJob) {
          return isReftest($scope.selectedJob);
      }
  }

  render() {
    return (
      <div id="job-details-actionbar">
        <nav className="navbar navbar-dark info-panel-navbar">
          <ul className="nav navbar-nav actionbar-nav">

            <li ng-repeat="job_log_url in job_log_urls">
              <a
                ng-if="job_log_url.parse_status == 'parsed'"
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
              </a>
              <a
                ng-if="job_log_url.parse_status == 'failed'"
                id="logviewer-btn"
                title="Log parsing has failed"
                className="disabled"
              >
                <img
                  alt="logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>
              <a
                ng-if="job_log_url.parse_status == 'pending'"
                id="logviewer-btn"
                className="disabled"
                title="Log parsing in progress"
              >
                <img
                  alt="logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>
            </li>
            <li>
              <a
                ng-if="!job_log_urls.length"
                id="logviewer-btn"
                className="disabled"
                title="No logs available for this job"
              >
                <img
                  alt="Logviewer"
                  src="../img/logviewerIcon.svg"
                  className="logviewer-icon"
                />
              </a>
            </li>

            <li ng-repeat="job_log_url in job_log_urls">
              <a
                id="raw-log-btn"
                className="raw-log-icon"
                title="Open the raw log in a new window"
                target="_blank"
                rel="noopener"
                href={job_log_url.url}
                copy-value={::job_log_url.url}
              ><span className="fa fa-file-text-o" /></a>
            </li>
            <li>
              <a
                ng-if="!job_log_urls.length"
                className="disabled raw-log-icon"
                title="No logs available for this job"
              ><span className="fa fa-file-text-o" /></a>
            </li>
            <li>
              <a
                id="pin-job-btn"
                href=""
                title="Add this job to the pinboard"
                className="icon-blue"
                ng-click="pinboard_service.pinJob(selectedJob)"
              ><span className="fa fa-thumb-tack" /></a>
            </li>
            <li>
              <button
                id="retrigger-btn"
                href=""
                ng-attr-title="{{user.isLoggedIn ? 'Repeat the selected job' : 'Must be logged in to retrigger a job'}}"
                ng-class="user.isLoggedIn ? 'icon-green' : 'disabled'"
                ng-disabled="!user.isLoggedIn"
                ng-click="retriggerJob([selectedJob])"
              >
                <span className="fa fa-repeat" />
              </button>
            </li>
            <li
              ng-if="isReftest()"
              ng-repeat="job_log_url in job_log_urls"
            >
              <a
                title="Launch the Reftest Analyser in a new window"
                target="_blank"
                rel="noopener"
                href={reftestUrl}
              ><span className="fa fa-bar-chart-o" /></a>
            </li>
            <li ng-show="canCancel()">
              <a
                ng-attr-title="{{user.isLoggedIn ? 'Cancel this job' : 'Must be logged in to cancel a job'}}"
                ng-class="user.isLoggedIn ? 'hover-warning' : 'disabled'"
                href=""
                ng-click="cancelJob()"
              ><span className="fa fa-times-circle cancel-job-icon" /></a>
            </li>
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
                  <button
                    id="backfill-btn"
                    href=""
                    className="dropdown-item"
                    ng-class="!user.isLoggedIn || !canBackfill() ? 'disabled' : ''"
                    ng-attr-title="{{ backfillButtonTitle() }}"
                    ng-disabled="!canBackfill()"
                    ng-click="!canBackfill() || backfillJob()"
                  >Backfill</button>
                </li>
                <li ng-if-start="job.taskcluster_metadata">
                  <a
                    target="_blank"
                    rel="noopener"
                    className="dropdown-item"
                    href={this.getInspectTaskUrl(job.taskcluster_metadata.task_id)}
                  >Inspect Task</a>
                </li>
                <li>
                  <a
                    target="_blank"
                    rel="noopener"
                    className="dropdown-item"
                    href={`${getInspectTaskUrl(job.taskcluster_metadata.task_id)}/create`}
                  >Edit and Retrigger</a>
                </li>
                <li>
                  <a
                    target="_blank"
                    rel="noopener"
                    className="dropdown-item"
                    href={`https://tools.taskcluster.net/tasks/${job.taskcluster_metadata.task_id}/interactive`}
                  >Create Interactive Task</a>
                </li>
                <li ng-if-end>
                  <a
                    ng-click="customJobAction()"
                    className="dropdown-item"
                  >Custom Action...</a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    );
  }
}

