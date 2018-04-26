import React from 'react';

export const InjectorContext = React.createContext();

export function with$injector(Component) {
  return function InjectorComponent(props) {
    return (
      <InjectorContext.Consumer>
        {$injector => <Component {...props} $injector={$injector} />}
      </InjectorContext.Consumer>
    );
  };
}
