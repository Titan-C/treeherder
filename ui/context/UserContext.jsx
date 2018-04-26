import React from 'react';

export const UserContext = React.createContext({
  isLoggedIn: false,
  email: null,
  isStaff: false,
});

export function withUser(Component) {
  return function UserComponent(props) {
    return (
      <UserContext.Consumer>
        {user => <Component {...props} user={user} />}
      </UserContext.Consumer>
    );
  };
}
