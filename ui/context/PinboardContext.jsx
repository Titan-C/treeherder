import React from 'react';

export const PinboardContext = React.createContext({
  pinnedJobs: [],
  relatedBugs: [],
  pinJob: (job) => {
    this.pinnedJobs[job.id] = job;
    // this.pulsePinCount();
  },
  addBug: (bug, job) => {
    this.relatedBugs[bug.id] = bug;
    this.pinJob(job);
    console.log("addBug", this.relatedBugs);
  }
});

export function withPinboard(Component) {
  return function PinboardComponent(props) {
    return (
      <PinboardContext.Consumer>
        {pinboard => <Component {...props} pinboard={pinboard} />}
      </PinboardContext.Consumer>
    );
  };
}
