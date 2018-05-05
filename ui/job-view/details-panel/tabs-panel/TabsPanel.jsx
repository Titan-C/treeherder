import React from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

import { with$injector } from '../../../context/InjectorContext';
import JobDetailsTab from './JobDetailsTab';
import FailureSummaryTab from './FailureSummaryTab';
import PerformanceTab from './PerformanceTab';
import AutoclassifyTab from './AutoclassifyTab';
import AnnotationsTab from './AnnotationsTab';
import SimilarJobsTab from './SimilarJobsTab';
import { thEvents } from '../../../js/constants';
import { getStatus } from '../../../helpers/jobHelper';
import { getAllUrlParams } from '../../../helpers/locationHelper';
import { withPinBoard } from '../../../context/PinBoardContext';

class TabsPanel extends React.Component {
  static getDerivedStateFromProps(nextProps) {
    const { perfJobDetail, showAutoclassifyTab, selectedJob } = nextProps;

    return { tabIndex: TabsPanel.getDefaultTabIndex(
      getStatus(selectedJob), !!perfJobDetail.length, showAutoclassifyTab)
    };
  }

  static getDefaultTabIndex(status, showPerf, showAutoclassify) {
    let idx = 0;
    const tabNames = [
      'details', 'failure', 'autoclassify', 'annotations', 'similar', 'perf'
    ].filter(name => (
      !((name === 'autoclassify' && !showAutoclassify) || (name === 'perf' && !showPerf))
    ));
    const tabIndexes = tabNames.reduce((acc, name) => ({ ...acc, [name]: idx++ }), {});

    let tabIndex = showPerf ? tabIndexes.perf : tabIndexes.details;
    if (['busted', 'testfailed', 'exception'].includes(status)) {
      tabIndex = showAutoclassify ? tabIndexes.autoclassify : tabIndexes.failure;
    }
    return tabIndex;
  }

  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.$rootScope = $injector.get("$rootScope");
    this.thClassificationTypes = $injector.get("thClassificationTypes");

    this.state = {
      showAutoclassifyTab: getAllUrlParams().has('autoclassify'),
      tabIndex: 0,
    };
  }

  componentDidMount() {
    this.$rootScope.$on(thEvents.selectNextTab, function () {
      // Establish the visible tabs for the job
      // const visibleTabs = [];
      // TODO: select the next tab

      // for (const i in thTabs.tabOrder) {
      //   if (thTabs.tabs[thTabs.tabOrder[i]].enabled) {
      //     visibleTabs.push(thTabs.tabOrder[i]);
      //   }
      // }

      // Establish where we are and increment one tab
      // let t = visibleTabs.indexOf(thTabs.selectedTab);
      // if (t === visibleTabs.length - 1) {
      //   t = 0;
      // } else {
      //   t++;
      // }
      //
      // // Select that new tab
      // thTabs.showTab(visibleTabs[t], $scope.selectedJob.id);
    });


  }

  componentWillUnmount() {

  }

  /**
   * Set the tab options and selections based on the selected job.
   * The default selected tab will be based on whether the job was a
   * success or failure.
   *
   * Some tabs will be shown/hidden based on the job (such as Talos)
   * and some based on query string params (such as autoClassification).
   *
   */
  // initializeTabs(job, hasPerformanceData) {
  //   let successTab = "jobDetails";
  //   let failTab = "failureSummary";
  //
  //   // Error Classification/autoclassify special handling
  //   if ($scope.tabService.tabs.autoClassification.enabled) {
  //     failTab = "autoClassification";
  //   }
  //
  //   $scope.tabService.tabs.perfDetails.enabled = hasPerformanceData;
  //   // the success tabs should be "performance" if job was not a build
  //   const jobType = job.job_type_name;
  //   if (hasPerformanceData && jobType !== "Build" && jobType !== "Nightly" &&
  //     !jobType.startsWith('build-')) {
  //     successTab = 'perfDetails';
  //   }
  //
  //   if (getStatus(job) === 'success') {
  //     $scope.tabService.selectedTab = successTab;
  //   } else {
  //     $scope.tabService.selectedTab = failTab;
  //   }
  // }

  closeJob() {
    // console.log("close the job now");
  }

  render() {
    const {
      jobDetails,
      fileBug, jobLogUrls, logParseStatus, suggestions, errors,
      bugSuggestionsLoading, selectedJob, perfJobDetail, repoName, jobRevision,
      classifications, togglePinBoardVisibility, isPinBoardVisible, pinBoard,
    } = this.props;
    const { showAutoclassifyTab, tabIndex } = this.state;
    const countPinnedJobs = pinBoard.pinnedJobs.length;

    return (
      <div id="tabs-panel" className="job-tabs-divider">
        <Tabs
          selectedTabClassName="selected-tab"
          selectedIndex={tabIndex}
          onSelect={tabIndex => this.setState({ tabIndex })}
        >
          <TabList>
            <Tab>Job Details</Tab>
            <Tab>Failure Summary</Tab>
            {showAutoclassifyTab && <Tab>Failure Classification</Tab>}
            <Tab>Annotations</Tab>
            <Tab>Similar Jobs</Tab>
            {!!perfJobDetail.length && <Tab>Performance</Tab>}
            <span className="info-panel-controls pull-right">
              <span
                id="pinboard-btn"
                className="btn pinboard-btn-text"
                onClick={togglePinBoardVisibility}
                title={isPinBoardVisible ? 'Close the pinboard' : 'Open the pinboard'}
              >PinBoard
                {!!countPinnedJobs && <div
                  title={`You have ${countPinnedJobs} job${countPinnedJobs > 1 ? 's' : ''} pinned`}
                  className={`pin-count-group ${countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''}`}
                >
                  <div
                    className={`pin-count-text ${countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''}`}
                  >{countPinnedJobs}</div>
                </div>}
                <span
                  className={`fa ${isPinBoardVisible ? 'fa-angle-down' : 'fa-angle-up'}`}
                />
              </span>
              <span
                onClick={this.closeJob}
                className="btn"
              ><span className="fa fa-times" /></span>
            </span>
          </TabList>

          <TabPanel>
            <JobDetailsTab jobDetails={jobDetails} />
          </TabPanel>
          <TabPanel>
            <div className="w-100 h-100">
              <FailureSummaryTab
                suggestions={suggestions}
                fileBug={fileBug}
                selectedJob={selectedJob}
                errors={errors}
                bugSuggestionsLoading={bugSuggestionsLoading}
                jobLogUrls={jobLogUrls}
                logParseStatus={logParseStatus}
              />
            </div>
          </TabPanel>
          {showAutoclassifyTab && <TabPanel>
            <AutoclassifyTab
              job={selectedJob}
              hasLogs={!!jobLogUrls.length}
              logsParsed={logParseStatus !== 'pending'}
              logParseStatus={logParseStatus}
            />
          </TabPanel>}
          <TabPanel>
            <AnnotationsTab
              classificationTypes={this.thClassificationTypes}
              classifications={classifications}
              selectedJob={selectedJob}
            />
          </TabPanel>
          <TabPanel>
            <SimilarJobsTab
              selectedJob={selectedJob}
              repoName={repoName}
            />
          </TabPanel>
          {!!perfJobDetail.length && <TabPanel>
            <PerformanceTab
              repoName={repoName}
              perfJobDetail={perfJobDetail}
              revision={jobRevision}
            />
          </TabPanel>}
        </Tabs>
      </div>
    );
  }
}

TabsPanel.propTypes = {
  $injector: PropTypes.object.isRequired,
  jobDetails: PropTypes.array.isRequired,
  repoName: PropTypes.string.isRequired,
  classifications: PropTypes.array.isRequired,
  pinBoard: PropTypes.object.isRequired,
  togglePinBoardVisibility: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  perfJobDetail: PropTypes.array,
  fileBug: PropTypes.func,
  suggestions: PropTypes.array,
  selectedJob: PropTypes.object,
  jobRevision: PropTypes.string,
  errors: PropTypes.array,
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.array,
  logParseStatus: PropTypes.string,
};

TabsPanel.defaultProps = {
  suggestions: [],
  selectedJob: null,
  errors: [],
  bugSuggestionsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
  perfJobDetail: [],
  jobRevision: null,
  fileBug: () => {}
};

export default with$injector(withPinBoard(TabsPanel));
