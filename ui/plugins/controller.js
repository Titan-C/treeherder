import $ from 'jquery';
import _ from 'lodash';
import jsyaml from 'js-yaml';
import { Queue, slugid } from 'taskcluster-client-web';

import treeherder from '../js/treeherder';
import thTaskcluster from '../js/services/taskcluster';
import tcJobActionsTemplate from '../partials/main/tcjobactions.html';
import intermittentTemplate from '../partials/main/intermittent.html';
import { getStatus, isReftest } from '../helpers/jobHelper';
import {
  getBugUrl,
  getSlaveHealthUrl,
  getInspectTaskUrl,
  getLogViewerUrl,
  getReftestUrl,
} from '../helpers/urlHelper';
import { thEvents } from "../js/constants";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', '$http', '$interpolate', '$uibModal',
    'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'dateFilter',
    'numberFilter', 'ThBugJobMapModel', 'thJobFilters',
    '$q', 'thPinboard',
    'ThJobDetailModel', 'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'ThModelErrors', 'ThTaskclusterErrors',
    'thTabs', '$timeout', 'ThResultSetStore',
    'PhSeries', 'tcactions', 'ThBugSuggestionsModel', 'ThTextLogStepModel',
    function PluginCtrl(
        $scope, $rootScope, $location, $http, $interpolate, $uibModal,
        ThJobClassificationModel,
        thClassificationTypes, ThJobModel, dateFilter,
        numberFilter, ThBugJobMapModel, thJobFilters,
        $q, thPinboard,
        ThJobDetailModel, thBuildApi, thNotify, ThJobLogUrlModel, ThModelErrors, ThTaskclusterErrors, thTabs,
        $timeout, ThResultSetStore, PhSeries,
        tcactions, ThBugSuggestionsModel, ThTextLogStepModel) {

        $scope.job = {};
        $scope.revisionList = [];


        $scope.fileBug = function (index) {
          const summary = $scope.suggestions[index].search;
          const crashRegex = /application crashed \[@ (.+)\]$/g;
          const crash = summary.match(crashRegex);
          const crashSignatures = crash ? [crash[0].split("application crashed ")[1]] : [];
          const allFailures = $scope.suggestions.map(sugg => (sugg.search.split(" | ")));

          const modalInstance = $uibModal.open({
            template: intermittentTemplate,
            controller: 'BugFilerCtrl',
            size: 'lg',
            openedClass: "filer-open",
            resolve: {
              summary: () => (summary),
              search_terms: () => ($scope.suggestions[index].search_terms),
              fullLog: () => ($scope.job_log_urls[0].url),
              parsedLog: () => ($scope.lvFullUrl),
              reftest: () => ($scope.isReftest() ? $scope.reftestUrl : ""),
              selectedJob: () => ($scope.selectedJob),
              allFailures: () => (allFailures),
              crashSignatures: () => (crashSignatures),
              successCallback: () => (data) => {
                // Auto-classify this failure now that the bug has been filed
                // and we have a bug number
                thPinboard.addBug({ id: data.success });
                $rootScope.$evalAsync(
                  $rootScope.$emit(
                    thEvents.saveClassification));
                // Open the newly filed bug in a new tab or window for further editing
                window.open(getBugUrl(data.success));
              }
            }
          });
          thPinboard.pinJob($scope.selectedJob);

          modalInstance.opened.then(function () {
            window.setTimeout(() => modalInstance.initiate(), 0);
          });
        };



        $scope.$watch('getCountPinnedJobs()', function (newVal, oldVal) {
            if (oldVal === 0 && newVal > 0) {
                $scope.isPinboardVisible = true;
                getRevisionTips($scope.revisionList);
            }
        });


        const selectJobAndRender = function (job) {
            $scope.jobLoadedPromise = selectJob(job);
            $('#info-panel').addClass('info-panel-slide');
            $scope.jobLoadedPromise.then(() => {
                thTabs.showTab(thTabs.selectedTab, job.id);
            });
        };

        $rootScope.$on(thEvents.jobClick, function (event, job) {
            selectJobAndRender(job);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.clearSelectedJob, function () {
            if (selectJobPromise !== null) {
                $timeout.cancel(selectJobPromise);
            }
        });

        $scope.bug_job_map_list = [];

        $scope.classificationTypes = thClassificationTypes;

        // load the list of existing classifications (including possibly a new one just
        // added).
        $scope.updateClassifications = function () {
            ThJobClassificationModel.get_list({ job_id: $scope.job.id }).then(function (response) {
                $scope.classifications = response;
                $scope.latestClassification = $scope.classifications[0];
            });
        };

        // load the list of bug associations (including possibly new ones just
        // added).
        $scope.updateBugs = function () {
            if (_.has($scope.job, "id")) {
                ThBugJobMapModel.get_list({ job_id: $scope.job.id }).then(function (response) {
                    $scope.bugs = response;
                });
            }
        };

        $rootScope.$on(thEvents.jobsClassified, function () {
            // use $timeout here so that all the other $digest operations related to
            // the event of ``jobsClassified`` will be done.  This will then
            // be a new $digest cycle.
            $timeout($scope.updateClassifications);
        });

        $rootScope.$on(thEvents.bugsAssociated, function () {
            $scope.updateBugs();
        });

        $rootScope.$on(thEvents.autoclassifyVerified, function () {
            // These operations are unneeded unless we verified the full job,
            // But getting that information to here seems to be non-trivial
            $scope.updateBugs();
            $timeout($scope.updateClassifications);
            ThResultSetStore.fetchJobs([$scope.job.id]);
            // Emit an event indicating that a job has been classified, although
            // it might in fact not have been
            const jobs = {};
            jobs[$scope.job.id] = $scope.job;
            $rootScope.$emit(thEvents.jobsClassified, { jobs: jobs });
        });

    }
]);
