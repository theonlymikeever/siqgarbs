import React, { Component } from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { ALL_ITEMS_QUERY } from './Items';

const DELETE_ITEM_MUTATION = gql`
  mutation DELETE_ITEM_MUTATION($id: ID!) {
    deleteItem(id: $id) {
      id
    }
  }
`;

export class DeleteItem extends Component {
  update = (cache, payload) => {
    // Apollo gives you access to two things: cache and payload
    // step 1: need to manually update the cache on the client
    const data = cache.readQuery({ query: ALL_ITEMS_QUERY });
    // step 2: filter the items
    data.items = data.items.filter(item => item.id !== payload.data.deleteItem.id);
    // step 3: write to the cache query
    cache.writeQuery({ query: ALL_ITEMS_QUERY, data });
  }
  render() {
    return (
      <Mutation
        mutation={DELETE_ITEM_MUTATION}
        variables={{
          id: this.props.id
        }}
        update={this.update}
      >
        {(deleteItem, { error }) => (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete?')) {
                deleteItem().catch(err => alert(err.message));
              }
            }}
          >
            {this.props.children}
          </button>
        )}
      </Mutation>
    );
  }
}

export default DeleteItem;
