import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import Title from './styles/Title';
import ItemStyles from './styles/ItemStyles';
import PriceTag from './styles/PriceTag';
import formatMoney from '../lib/formatMoney';
import DeleteItem from './DeleteItem';
import AddToCart from './AddToCart';

const LOCAL_USER_QUERY = gql`
  query {
    me @client
  }
`;

export default class Item extends Component {
  static propTypes = {
    item: PropTypes.object.isRequired
  };

  render() {
    const { item } = this.props;
    return (
      <ItemStyles>
        {item.image && <img src={item.image} alt={item.title} />}
        <Title>
          <Link
            href={{
              pathname: '/item',
              query: { id: item.id }
            }}
          >
            <a>{item.title}</a>
          </Link>
        </Title>
        <PriceTag>{formatMoney(item.price)}</PriceTag>
        <p>{item.description}</p>
        <Query query={LOCAL_USER_QUERY}>
          {({ data: { me } }) => (
            <div className="buttonList">
              {me ? (
                <>
                  <Link
                    href={{
                      pathname: '/update',
                      query: { id: item.id }
                    }}
                  >
                    <a>Edit ✏️</a>
                  </Link>
                  <AddToCart id={item.id} />
                  <DeleteItem id={item.id}>Delete This Item</DeleteItem>
                </>
              ) : (
                <Link href="/signup">
                  <button>Adding to Cart</button>
                </Link>
              )}
            </div>
          )}
        </Query>
      </ItemStyles>
    );
  }
}
