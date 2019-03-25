import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import { format, formatDistance } from 'date-fns';
import Link from 'next/link';
import styled from 'styled-components';
import Error from './ErrorMessage';
import OrderItemStyles from './styles/OrderItemStyles';
import formatMoney from '../lib/formatMoney';

const ALL_ORDERS_QUERY = gql`
  query ALL_ORDERS_QUERY {
    orders(orderBy: createdAt_DESC) {
      id
      items {
        id
        title
        description
        image
        price
        quantity
      }
      total
      createdAt
    }
  }
`;

const OrderUl = styled.ul`
  display: grid;
  grid-gap: 4rem;
  grid-template-columns: repeat(auto-fit, minmax(50%, 1fr));
  padding-left: 0;
`;

class OrderList extends React.Component {
  render() {
    return (
      <Query query={ALL_ORDERS_QUERY}>
        {({ data, error, loading }) => {
          if (error) return <Error error={error} />;
          if (loading) return <p>Loading...</p>;
          if (!data.orders.length) return <p>You have no orders 😞 </p>;
          const orders = data.orders;
          return (
            <div>
              <h2>You have {orders.length} order{orders.length > 1 ? 's' : ''}</h2>
              <OrderUl>
                {orders.map(order => (
                  <OrderItemStyles key={order.id}>
                    <Link href={{
                      pathname: '/order',
                      query: { id: order.id }
                    }}>
                      <a>
                        <div className="order-meta">
                          <p>{order.items.reduce((a, b) => a + b.quantity, 0)} Items</p>
                          <p>{order.items.length} Products</p>
                          <p>{formatDistance(order.createdAt, new Date())}</p>
                          <p>{formatMoney(order.total)}</p>
                        </div>
                        <div className="images">
                          {order.items.map(item => (
                            <img key={item.id} src={item.image} alt={item.title} />
                          ))}
                        </div>
                      </a>
                    </Link>
                  </OrderItemStyles>
                ))}
              </OrderUl>
            </div>
          )
        }}
      </Query>
    );
  }
}

export default OrderList;
export { ALL_ORDERS_QUERY };