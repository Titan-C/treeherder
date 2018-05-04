import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import _ from 'lodash';
import Select from 'react-select';
import Mousetrap from "mousetrap";

import { getBtnClass, getStatus } from '../../../helpers/jobHelper';
import { thEvents, thPinboardCountError } from "../../../js/constants";
import { PinBoardContext } from "../../../context/PinBoardContext";
import { with$injector } from '../../../context/InjectorContext';

class PinBoard extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.ThJobClassificationModel = $injector.get('ThJobClassificationModel');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThModelErrors = $injector.get('ThModelErrors');
    this.ThBugJobMapModel = $injector.get('ThBugJobMapModel');

    this.maxNumPinned = 500;

    this.state = {
      pinnedJobs: [],
      relatedBugs: [],
      hasPinnedJobs: false,
      failureClassificationId: 0,
      enteringBugNumber: false,
      classification: {},
    };
  }

  componentDidMount() {
    this.$rootScope.$on(thEvents.toggleJobPin, (event, job) => {
      this.toggleJobPin(job);
    });

    this.$rootScope.$on(thEvents.jobPin, (event, job) => {
      this.pinJob(job);
    });

    this.$rootScope.$on(thEvents.addRelatedBug, (event, job) => {
      this.pinJob(job);
      this.toggleEnterBugNumber(true);
    });

    this.$rootScope.$on(thEvents.saveClassification, () => {
      if (this.isPinboardVisible) {
        this.save();
      }
    });

    this.$rootScope.$on(thEvents.clearPinboard, () => {
      if (this.isPinboardVisible) {
        this.unPinAll();
      }
    });

    // Triggered on pin api events eg. from the job details navbar
    this.$rootScope.$on(thEvents.pulsePinCount, () => {
      this.pulsePinCount();
    });
  }

  getHoverText(job) {
    const duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);
    const status = getStatus(job);
    return job.job_type_name + " - " + status + " - " + duration + "mins";
  }

  getBtnClass(job) {
    getBtnClass(getStatus(job), job.failure_classification_id);
  }

  toggleJobPin(job) {
    if (this.state.pinnedJobs[job.id]) {
      this.unPinJob(job.id);
    } else {
      this.pinJob(job);
    }
    if (!this.selectedJob) {
      this.viewJob(job);
    }
  }

  pulsePinCount() {
    $(".pin-count-group").addClass("pin-count-pulse");
    window.timeout(() => {
      $(".pin-count-group").removeClass("pin-count-pulse");
    }, 700);
  }

  pinJob(job) {
    const { pinnedJobs, spaceRemaining } = this.state;

    if (spaceRemaining > 0) {
      this.setState({ pinnedJobs: { ...pinnedJobs, [job.id]: job } });
      this.pulsePinCount();
    } else {
      this.thNotify.send(thPinboardCountError, 'danger');
    }
    if (!this.state.selectedJob) {
      this.viewJob(job);
    }
  }

  unPinJob(id) {
    const { pinnedJobs } = this.state;

    delete pinnedJobs[id];
    this.setState({ pinnedJobs: [...pinnedJobs] });
  }

  pinJobs(jobsToPin) {
    jobsToPin.forEach(this.pinJob);
  }

  pinAllShownJobs() {
    if (!this.spaceRemaining()) {
      this.thNotify.send(thPinboardCountError, 'danger', { sticky: true });
      return;
    }
    const shownJobs = this.ThResultSetStore.getAllShownJobs(
      this.spaceRemaining(),
      thPinboardCountError
    );
    this.pinJobs(shownJobs);

    if (!this.$rootScope.selectedJob) {
      this.$rootScope.selectedJob = shownJobs[0];
    }
  }

  addBug(bug, job) {
    const { relatedBugs } = this.state;

    relatedBugs[bug.id] = bug;
    this.setState({ relatedBugs: [...relatedBugs] });
    if (job) {
        this.pinJob(job);
    }
  }

  removeBug(id) {
    delete this.state.relatedBugs[id];
  }

  unPinAll() {
    const { pinnedJobs, relatedBugs } = this.state;

    for (const jid in pinnedJobs) {
      if (pinnedJobs.hasOwnProperty(jid)) {
        delete pinnedJobs[jid];
      }
    }
    for (const bid in relatedBugs) {
      if (relatedBugs.hasOwnProperty(bid)) {
        delete relatedBugs[bid];
      }
    }
    this.setState({
                    pinnedJobs: [...pinnedJobs],
                    relatedBugs: [...relatedBugs],
                    classification: this.createNewClassification()
                  });
  }

  save() {
    const { isLoggedIn } = this.props;
    const { pinnedJobs } = this.state;

    let errorFree = true;
    if (this.state.enteringBugNumber) {
      // we should save this for the user, as they likely
      // just forgot to hit enter. Returns false if invalid
      errorFree = this.saveEnteredBugNumber();
      if (!errorFree) {
        this.thNotify.send("Please enter a valid bug number", "danger");
      }
    }
    if (!this.canSaveClassifications() && isLoggedIn) {
      this.thNotify.send("Please classify this failure before saving", "danger");
      errorFree = false;
    }
    if (!isLoggedIn) {
      this.thNotify.send("Must be logged in to save job classifications", "danger");
      errorFree = false;
    }
    if (errorFree) {
      pinnedJobs.forEach(job => this.saveClassification(job));
      this.$rootScope.$emit(thEvents.jobsClassified, { jobs: [...pinnedJobs] });

      pinnedJobs.forEach(job => this.saveBugs(job));
      this.$rootScope.$emit(thEvents.bugsAssociated, { jobs: [...pinnedJobs] });

      this.unPinAll();

      this.completeClassification();
      this.setState({ classification: this.createNewClassification() });

      // HACK: it looks like Firefox on Linux and Windows doesn't
      // want to accept keyboard input after this change for some
      // reason which I don't understand. Chrome (any platform)
      // or Firefox on Mac works fine though.
      document.activeElement.blur();
    }
  }

  // open form to create a new note. default to intermittent
  createNewClassification() {
    const { email } = this.props;

    return new this.ThJobClassificationModel({
      text: "",
      who: email,
      failure_classification_id: 4
    });
  }

  saveClassification(job) {
    const classification = new this.ThJobClassificationModel(this);

    // classification can be left unset making this a no-op
    if (classification.failure_classification_id > 0) {
      job.failure_classification_id = classification.failure_classification_id;

      // update the unclassified failure count for the page
      this.ThResultSetStore.updateUnclassifiedFailureMap(job);

      classification.job_id = job.id;
      classification.create()
        .then(() => {
          this.thNotify.send("Classification saved for " + job.platform + " " + job.job_type_name, "success");
        }).catch((response) => {
        const message = "Error saving classification for " + job.platform + " " + job.job_type_name;
        this.thNotify.send(
          this.ThModelErrors.format(response, message),
          "danger"
        );
      });
    }
  }

  saveBugs(job) {
    const { relatedBugs } = this.state;

    Object.values(relatedBugs).forEach((bug) => {
      const bjm = new this.ThBugJobMapModel({
        bug_id: bug.id,
        job_id: job.id,
        type: 'annotation'
      });
      bjm.create()
        .then(() => {
          this.thNotify.send(`Bug association saved for ${job.platform} ${job.job_type_name}`, "success");
        })
        .catch((response) => {
          const message = `Error saving bug association for ${job.platform} ${job.job_type_name}`;
          this.thNotify.send(this.ThModelErrors.format(response, message), "danger");
      });
    });
  }

  isSHAorCommit(str) {
    return /^[a-f\d]{12,40}$/.test(str) || str.includes("hg.mozilla.org");
  }

  // If the pasted data is (or looks like) a 12 or 40 char SHA,
  // or if the pasted data is an hg.m.o url, automatically select
  // the "fixed by commit" classification type
  pasteSHA(evt) {
    const pastedData = evt.originalEvent.clipboardData.getData('text');
    if (this.isSHAorCommit(pastedData)) {
      this.state.classification.failure_classification_id = 2;
    }
  }

  retriggerAllPinnedJobs() {
    // pushing pinned jobs to a list.
    this.retriggerJob(Object.values(this.state.pinnedJobs));
  }

  cancelAllPinnedJobsTitle() {
    if (!this.props.isLoggedIn) {
      return "Not logged in";
    } else if (!this.canCancelAllPinnedJobs()) {
      return "No pending / running jobs in pinBoard";
    }

    return "Cancel all the pinned jobs";
  }

  canCancelAllPinnedJobs() {
    const cancellableJobs = Object.values(this.state.pinnedJobs).filter(
      job => (job.state === 'pending' || job.state === 'running'));
    return this.props.isLoggedIn && cancellableJobs.length > 0;
  }

  cancelAllPinnedJobs() {
    if (window.confirm('This will cancel all the selected jobs. Are you sure?')) {
      this.cancelJobs(Object.values(this.state.pinnedJobs));
    }
  }

  canSaveClassifications() {
    const thisClass = this.state.classification;
    return this.hasPinnedJobs() && this.props.isLoggedIn &&
      (!!PinBoardContext.relatedBugs.length ||
        (thisClass.failure_classification_id !== 4 && thisClass.failure_classification_id !== 2) ||
        this.$rootScope.currentRepo.is_try_repo ||
        this.$rootScope.currentRepo.repository_group.name === "project repositories" ||
        (thisClass.failure_classification_id === 4 && thisClass.text.length > 0) ||
        (thisClass.failure_classification_id === 2 && thisClass.text.length > 7));
  }

  // Facilitates Clear all if no jobs pinned to reset pinBoard UI
  pinboardIsDirty() {
    return this.state.classification.text !== '' ||
      !!PinBoardContext.relatedBugs.length ||
      this.state.classification.failure_classification_id !== 4;
  }

  // Dynamic btn/anchor title for classification save
  saveUITitle(category) {
    let title = "";

    if (!this.props.isLoggedIn) {
      title = title.concat("not logged in / ");
    }

    if (category === "classification") {
      if (!this.canSaveClassifications()) {
        title = title.concat("ineligible classification data / ");
      }
      if (!this.hasPinnedJobs()) {
        title = title.concat("no pinned jobs");
      }
      // We don't check pinned jobs because the menu dropdown handles it
    } else if (category === "bug") {
      if (!this.hasRelatedBugs()) {
        title = title.concat("no related bugs");
      }
    }

    if (title === "") {
      title = "Save " + category + " data";
    } else {
      // Cut off trailing "/ " if one exists, capitalize first letter
      title = title.replace(/\/ $/, "");
      title = title.replace(/^./, l => l.toUpperCase());
    }
    return title;
  }

  hasPinnedJobs() {
    return !_.isEmpty(this.state.pinnedJobs);
  }

  hasRelatedBugs() {
    return !_.isEmpty(this.state.relatedBugs);
  }

  spaceRemaining() {
    return this.maxNumPinned - this.state.pinnedJobs.length;
  }

  handleRelatedBugDocumentClick(event) {
    if (!$(event.target).hasClass("add-related-bugs-input")) {
      this.$apply(() => {
        if (this.state.newEnteredBugNumber) {
          this.saveEnteredBugNumber();
        } else {
          this.toggleEnterBugNumber(false);
        }
      });
    }
  }

  toggleEnterBugNumber(tf) {
    this.state.enteringBugNumber = tf;
    this.state.focusInput = tf;

    document.off('click', this.handleRelatedBugDocumentClick);
    if (tf) {
      // Rebind escape to canceling the bug entry, pressing escape
      // again will close the pinBoard as usual.
      Mousetrap.bind('escape', () => {
        const cancel = this.toggleEnterBugNumber.bind(this, false);
        cancel();
      });

      // Install a click handler on the document so that clicking
      // outside of the input field will close it. A blur handler
      // can't be used because it would have timing issues with the
      // click handler on the + icon.
      window.timeout(() => {
        document.on('click', this.handleRelatedBugDocumentClick);
      }, 0);
    } else {
      this.state.newEnteredBugNumber = '';
    }
  }

  completeClassification() {
    this.$rootScope.$broadcast('blur-this', "classification-comment");
  }

  // The manual bug entry input eats the global ctrl+enter save() shortcut.
  // Force that event to be emitted so ctrl+enter saves the classification.
  ctrlEnterSaves(ev) {
    if (ev.ctrlKey && ev.keyCode === 13) {
      this.$evalAsync(this.$rootScope.$emit(thEvents.saveClassification));
    }
  }

  saveEnteredBugNumber() {
    if (this.state.enteringBugNumber) {
      if (!this.state.newEnteredBugNumber) {
        this.toggleEnterBugNumber(false);
      } else if (/^[0-9]*$/.test(this.state.newEnteredBugNumber)) {
        PinBoardContext.addBug({ id: this.state.newEnteredBugNumber });
        this.toggleEnterBugNumber(false);
        return true;
      }
    }
  }

  viewJob(job) {
    this.$rootScope.selectedJob = job;
    this.$rootScope.$emit(thEvents.jobClick, job);
    this.$rootScope.$emit(thEvents.selectJob, job);
  }

  render() {
    const {
      selectedJob,
      classificationTypes,
      revisionList,
      isLoggedIn,
      isVisible,
    } = this.props;
    const {
      pinnedJobs,
      hasPinnedJobs,
      relatedBugs,
      failureClassificationId,
      enteringBugNumber
    } = this.state;
    const classificationOptions = classificationTypes; // make options for the classification Select object

    return (
      <PinBoardContext.Provider value={pinnedJobs}>
        <div className={isVisible ? '' : 'hidden'} >
          <div id="pinned-job-list">
            <div className="content">
              {hasPinnedJobs && <span
                className="pinboard-preload-txt"
              >press spacebar to pin a selected job</span>}
              {pinnedJobs.map(job => (
                <span className="btn-group">
                  <span
                    className={`btn pinned-job ${this.getBtnClass(job)} ${selectedJob === job ? 'btn-lg selected-job' : 'btn-xs'}`}
                    title={() => this.getHoverText(job)}
                    onClick={this.viewJob(job)}
                    data-job-id={job.job_id}
                  >{job.job_type_symbol}</span>
                  <span
                    className={`btn btn-ltgray pinned-job-close-btn ${selectedJob === job ? 'btn-lg selected-job' : 'btn-xs'}`}
                    onClick={() => this.unPinJob(job.id)}
                    title="un-pin this job"
                  ><i className="fa fa-times" /></span>
                </span>
              ))}
            </div>
          </div>

          {/* Related bugs */}
          <div id="pinboard-related-bugs">
            <div className="content">
              <a
                onClick={() => this.toggleEnterBugNumber(!enteringBugNumber)}
                className="pointable"
                title="Add a related bug"
              ><i className="fa fa-plus-square add-related-bugs-icon" /></a>
              {!relatedBugs.length && <span
                className="pinboard-preload-txt pinboard-related-bug-preload-txt"
                onClick={() => {
                  this.toggleEnterBugNumber(!enteringBugNumber);
                  this.allowKeys();
                }}
              >click to add a related bug</span>}
              {enteringBugNumber && <form
                submit={this.saveEnteredBugNumber}
                className="add-related-bugs-form"
              >
                <input
                  id="related-bug-input"
                  data-bug-input
                  className="add-related-bugs-input"
                  ng-model="$parent.newEnteredBugNumber"
                  placeholder="enter bug number"
                  ng-keypress="ctrlEnterSaves($event)"
                  focus-me="focusInput"
                />
              </form>}
              {relatedBugs.map(bug => (<span>
                <span className="btn-group pinboard-related-bugs-btn">
                  <a
                    className="btn btn-xs related-bugs-link"
                    title={bug.summary}
                    href={() => this.getBugUrl(bug.id)}
                    target="_blank"
                    rel="noopener"
                  ><em>{bug.id}</em></a>
                  <span
                    className="btn btn-ltgray btn-xs pinned-job-close-btn"
                    onClick={() => this.removeBug(bug.id)}
                    title="remove this bug"
                  ><i className="fa fa-times" /></span>
                </span>
              </span>))}
            </div>
          </div>

          {/* Classification dropdown */}
          <div id="pinboard-classification">
            <div className="pinboard-label">classification</div>
            <div id="pinboard-classification-content" className="content">
              <form onSubmit={this.completeClassification} className="form">
                <Select
                  id="pinboard-classification-select"
                  value={failureClassificationId}
                  options={classificationOptions}
                  onChange={this.setClassificationId}
                  clearable={false}
                  bsSize="small"
                />

                {/* Classification comment */}
                <div className="classification-comment-container">
                  <input
                    id="classification-comment"
                    type="text"
                    className="form-control add-classification-input"
                    ng-model="classification.text"
                    onClick={this.allowKeys}
                    ng-paste="pasteSHA($event)"
                    placeholder="click to add comment"
                  />
                  {/*blur-this*/}
                  <div ng-if="classification.failure_classification_id === 2">
                    <Select
                      id="recent-choice"
                      clearable={false}
                      bsSize="small"
                      ng-model="classification.recentChoice"
                      ng-change="classification.text=classification.recentChoice"
                    >
                      <option value="0" selected disabled>Choose a recent
                        commit
                      </option>
                      {revisionList.slice(0, 20).map(tip => (<option
                        ng-repeat="tip in revisionList | limitTo:20"
                        title="{{tip.title}}"
                        value="{{tip.revision}}"
                      >{tip.revision.slice(0, 12)} {tip.author}</option>))}
                    </Select>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Save UI */}
          <div
            id="pinboard-controls"
            className="btn-group-vertical"
            title={pinnedJobs.length ? '' : 'No pinned jobs'}
          >
            <div className="btn-group save-btn-group dropdown">
              <button
                className="btn btn-light-bordered btn-xs save-btn"
                title="{{ saveUITitle('classification') }}"
                onClick={this.save}
                ng-disabled="!user.isLoggedIn || !canSaveClassifications()"
              >save
              </button>
              <button
                className="btn btn-light-bordered btn-xs dropdown-toggle save-btn-dropdown"
                title="{{ !hasPinnedJobs() && !pinboardIsDirty() ? 'No pinned jobs' : 'Additional pinboard functions' }}"
                ng-disabled="!hasPinnedJobs() && !pinboardIsDirty()"
                type="button"
                data-toggle="dropdown"
              >
                <span className="caret" />
              </button>
              <ul className="dropdown-menu save-btn-dropdown-menu">
                <li
                  className="{{ !user.isLoggedIn ? 'disabled' : '' }}"
                  title="{{ !user.isLoggedIn ? 'Not logged in' : 'Repeat the pinned jobs'}}"
                >
                  <a
                    className="dropdown-item"
                    onClick={() => !isLoggedIn || this.retriggerAllPinnedJobs}
                  >Retrigger all</a></li>
                <li
                  className="{{ canCancelAllPinnedJobs() ? '' : 'disabled' }}"
                  title="{{ cancelAllPinnedJobsTitle() }}"
                >
                  <a
                    className="dropdown-item"
                    onClick={() => this.canCancelAllPinnedJobs && this.cancelAllPinnedJobs}
                  >Cancel all</a>
                </li>
                <li><a className="dropdown-item" onClick={this.unPinAll}>Clear
                  all</a></li>
              </ul>
            </div>
          </div>

        </div>
      </PinBoardContext.Provider>
    );
  }
}

PinBoard.propTypes = {
  $injector: PropTypes.object.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isVisible: PropTypes.bool.isRequired,
  email: PropTypes.string,
  selectedJob: PropTypes.object,
  classificationTypes: PropTypes.object,
  revisionList: PropTypes.array,
};

PinBoard.defaultProps = {
  email: null,
  selectedJob: null,
  classificationTypes: null,
  revisionList: [],
};

export default with$injector(PinBoard);
