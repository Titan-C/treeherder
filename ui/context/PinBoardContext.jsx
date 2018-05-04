import React from 'react';

export const PinBoardContext = React.createContext({
  pinnedJobs: [],
  relatedBugs: [],
  pinJob: (job) => {
    this.pinnedJobs[job.id] = job;
    // this.pulsePinCount();
  },
  addBug: (bug, job) => {
    this.relatedBugs[bug.id] = bug;
    this.pinJob(job);
  }
});

export function withPinBoard(Component) {
  return function PinBoardComponent(props) {
    return (
      <PinBoardContext.Consumer>
        {pinBoard => <Component {...props} pinBoard={pinBoard} />}
      </PinBoardContext.Consumer>
    );
  };
}
