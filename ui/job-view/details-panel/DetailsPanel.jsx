import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from "react2angular/index.es2015";
import { chunk } from 'lodash';

import { InjectorContext } from '../../context/InjectorContext';
import TabsPanel from './tabs-panel/TabsPanel';
import treeherder from "../../js/treeherder";
import { getLogViewerUrl, getReftestUrl } from "../../helpers/urlHelper";
import SummaryPanel from './summary-panel/SummaryPanel';
import PinBoard from './pinboard/PinBoard';
import { thEvents, thBugSuggestionLimit } from '../../js/constants';

class DetailsPanel extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.$rootScope = $injector.get("$rootScope");
    this.ThJobModel = $injector.get("ThJobModel");
    this.ThJobDetailModel = $injector.get("ThJobDetailModel");
    this.ThJobLogUrlModel = $injector.get("ThJobLogUrlModel");
    this.PhSeries = $injector.get("PhSeries");
    this.ThResultSetStore = $injector.get("ThResultSetStore");
    this.ThBugSuggestionsModel = $injector.get("ThBugSuggestionsModel");
    this.ThTextLogStepModel = $injector.get("ThTextLogStepModel");
    this.ThJobClassificationModel = $injector.get("ThJobClassificationModel");

    // this promise will void all the ajax requests
    // triggered by selectJob once resolved
    this.selectJobPromise = null;

    this.state = {
      isPinBoardVisible: false,
      jobDetails: [],
      jobLogUrls: [],
      jobDetailLoading: false,
      jobLogsAllParsed: false,
      lvUrl: null,
      lvFullUrl: null,
      reftestUrl: null,
      perfJobDetail: [],
      jobRevision: null,
      logParseStatus: 'unavailable',
      classifications: [],
      suggestions: [],
      errors: [],
      bugSuggestionsLoading: false,
    };
  }

  componentDidMount() {
    this.$rootScope.$on(thEvents.jobClick, (evt, job) => {
      // console.log("jobClick", a, b);
      this.selectJob(job);
    });
  }

  togglePinBoardVisibility() {
      this.setState({ isPinBoardVisible: !this.state.isPinBoardVisible });
  }

  loadBugSuggestions(job) {
      const { repoName } = this.props;

      this.ThBugSuggestionsModel.query({
          project: repoName,
          jobId: job.id
      }, (suggestions) => {
          suggestions.forEach(function (suggestion) {
              suggestion.bugs.too_many_open_recent = (
                  suggestion.bugs.open_recent.length > thBugSuggestionLimit
              );
              suggestion.bugs.too_many_all_others = (
                  suggestion.bugs.all_others.length > thBugSuggestionLimit
              );
              suggestion.valid_open_recent = (
                  suggestion.bugs.open_recent.length > 0 &&
                      !suggestion.bugs.too_many_open_recent
              );
              suggestion.valid_all_others = (
                  suggestion.bugs.all_others.length > 0 &&
                      !suggestion.bugs.too_many_all_others &&
                      // If we have too many open_recent bugs, we're unlikely to have
                      // relevant all_others bugs, so don't show them either.
                      !suggestion.bugs.too_many_open_recent
              );
          });

          // if we have no bug suggestions, populate with the raw errors from
          // the log (we can do this asynchronously, it should normally be
          // fast)
          if (!suggestions.length) {
              this.ThTextLogStepModel.query({
                  project: repoName,
                  jobId: job.id
              }, (textLogSteps) => {
                  const errors = textLogSteps
                      .filter(step => step.result !== 'success')
                      .map(step => ({
                        name: step.name,
                        result: step.result,
                        lvURL: getLogViewerUrl(job.id, repoName, step.finished_line_number)
                      }));
                  this.setState({ errors });
              });
          }

          this.setState({ bugSuggestionsLoading: false, suggestions });
      });
  }

  async updateClassifications(job) {
    const classifications = await this.ThJobClassificationModel.get_list({ job_id: job.id });
    this.setState({ classifications });
  }

  selectJob(newJob) {
    const { repoName } = this.props;
    this.setState({ jobDetailLoading: true });

    if (this.selectJobPromise !== null) {
      this.selectJobPromise.resolve("cancel");
    }

    let jobDetails = [];
    const jobPromise = this.ThJobModel.get(
      repoName, newJob.id,
      { timeout: this.selectJobPromise });

    const jobDetailPromise = this.ThJobDetailModel.getJobDetails(
      { job_guid: newJob.job_guid },
      { timeout: this.selectJobPromise });

    const jobLogUrlPromise = this.ThJobLogUrlModel.get_list(
      newJob.id,
      { timeout: this.selectJobPromise });

    const phSeriesPromise = this.PhSeries.getSeriesData(
      repoName, { job_id: newJob.id });

    this.selectJobPromise = Promise.all([
      jobPromise,
      jobDetailPromise,
      jobLogUrlPromise,
      phSeriesPromise
    ]).then(async (results) => {

      //the first result comes from the job promise
      const job = results[0];
      const jobRevision = this.ThResultSetStore.getPush(job.result_set_id).revision;

      // the second result comes from the job detail promise
      jobDetails = results[1];

      // incorporate the buildername into the job details if this is a buildbot job
      // (i.e. it has a buildbot request id)
      const buildbotRequestIdDetail = jobDetails.find(detail => detail.title === 'buildbot_request_id');
      if (buildbotRequestIdDetail) {
        jobDetails = [...jobDetails, { title: "Buildername", value: job.ref_data_name }];
      }

      // the third result comes from the jobLogUrl promise
      // exclude the json log URLs
      const jobLogUrls = results[2].filter(log => !log.name.endsWith("_json"));

      let logParseStatus = 'unavailable';
      // Provide a parse status as a scope variable for logviewer shortcut
      if (jobLogUrls.length && jobLogUrls[0].parse_status) {
        logParseStatus = jobLogUrls[0].parse_status;
      }

      // Provide a parse status for the model
      const jobLogsAllParsed = (jobLogUrls ?
        jobLogUrls.every(jlu => jlu.parse_status !== 'pending') :
        false);

      const lvUrl = getLogViewerUrl(job.id, repoName);
      const lvFullUrl = location.origin + "/" + lvUrl;
      const reftestUrl = jobLogUrls.length ?
        `${getReftestUrl(jobLogUrls[0].url)}&only_show_unexpected=1` :
        '';

      const performanceData = Object.values(results[3]).flatten();

      let perfJobDetail = [];
      if (performanceData) {
        const signatureIds = [...new Set(performanceData.map(perf => perf.signature_id))];
        const seriesListList = await Promise.all(chunk(signatureIds, 20).map(
          signatureIdChunk => this.PhSeries.getSeriesList(repoName, { id: signatureIdChunk })
        ));
        const seriesList = seriesListList.flatten();

        perfJobDetail = performanceData.map(d => ({
          series: seriesList.find(s => d.signature_id === s.id),
          ...d
        })).filter(d => !d.series.parentSignature).map(d => ({
          url: `/perf.html#/graphs?series=${[repoName, d.signature_id, 1, d.series.frameworkId]}&selected=${[repoName, d.signature_id, job.result_set_id, d.id]}`,
          value: d.value,
          title: d.series.name
        }));
      }

      // set the tab options and selections based on the selected job
      // initializeTabs($scope.job, (Object.keys(performanceData).length > 0));

      this.setState({
        jobDetailLoading: false,
        jobLogUrls,
        jobDetails,
        jobLogsAllParsed,
        logParseStatus,
        lvUrl,
        lvFullUrl,
        reftestUrl,
        perfJobDetail,
        jobRevision,
      }, async () => {
        await this.updateClassifications(job);
        // this.updateBugs();
        this.loadBugSuggestions(job);
      });
      this.selectJobPromise = null;
    });
  }


  // getRevisionTips(list) {
  //     list.splice(0, list.length);
  //     const rsArr = ThResultSetStore.getPushArray();
  //     rsArr.forEach((rs) => {
  //         list.push({
  //             revision: rs.revision,
  //             author: rs.author,
  //             title: rs.revisions[0].comments.split('\n')[0]
  //         });
  //     });
  // };


  render() {
    const { selectedJob, repoName, $injector, user, currentRepo } = this.props;
    const {
      isPinBoardVisible,
      jobDetails,
      jobRevision,
      jobLogUrls,
      jobDetailLoading,
      perfJobDetail,
      suggestions,
      errors,
      bugSuggestionsLoading,
      logParseStatus,
      classifications,
      lvUrl,
      lvFullUrl,
    } = this.state;

    return (
      <div
        className={selectedJob ? 'info-panel-slide' : 'hidden'}
      >
        <InjectorContext.Provider value={$injector}>
          <div
            id="info-panel-resizer"
            resizer="horizontal"
            resizer-height="6"
            resizer-bottom="#info-panel"
          />
          <PinBoard
            id="pinboard-panel"
            isVisible={isPinBoardVisible}
            isLoggedIn={user.isLoggedIn || false}
          />
          {!!selectedJob && <div id="info-panel-content">
            <SummaryPanel
              repoName={repoName}
              selectedJob={selectedJob}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
              jobDetailLoading={jobDetailLoading}
              latestClassification={classifications.length ? classifications[0] : null}
              isTryRepo={currentRepo.isTryRepo}
              lvUrl={lvUrl}
              lvFullUrl={lvFullUrl}
            />
            <TabsPanel
              jobDetails={jobDetails}
              perfJobDetail={perfJobDetail}
              selectedJob={selectedJob}
              repoName={repoName}
              jobRevision={jobRevision}
              suggestions={suggestions}
              errors={errors}
              bugSuggestionsLoading={bugSuggestionsLoading}
              logParseStatus={logParseStatus}
              classifications={classifications}
              jobLogUrls={jobLogUrls}
              isPinBoardVisible={isPinBoardVisible}
              togglePinBoardVisibility={() => this.togglePinBoardVisibility()}
            />
          </div>}
          <div id="clipboard-container"><textarea id="clipboard" />
          </div>
        </InjectorContext.Provider>
      </div>
    );
  }
}

DetailsPanel.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.object,
  user: PropTypes.object,
  currentRepo: PropTypes.object,
};

DetailsPanel.defaultProps = {
  selectedJob: null,
  user: { isLoggedIn: false, isStaff: false, email: null },
  currentRepo: { isTryRepo: true }
};

treeherder.component('detailsPanel', react2angular(
  DetailsPanel,
  ['repoName', 'selectedJob', 'user'],
  ['$injector']));
