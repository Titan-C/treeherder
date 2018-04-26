import React from 'react';
import PropTypes from 'prop-types';

function ListItem(props) {
  return (
    <li>
      <p className="failure-summary-line-empty mb-0">{props.text}</p>
    </li>
  );
}

ListItem.propTypes = {
  text: PropTypes.string.isRequired,
};

export default ListItem;
