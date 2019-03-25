import React from 'react';
import Link from 'next/link';
import { Query } from 'react-apollo';
import { adopt } from 'react-adopt';
import styled from 'styled-components';
import { ALL_ORDERS_QUERY } from './OrderList';
import Error from './ErrorMessage';
import User from './User';

const Container = styled.div`
  margin: 0 auto;
  max-width: 1000px;
  border: 1px solid ${props => props.theme.offWhite};
  box-shadow: ${props => props.theme.bs};
  padding: 2rem;
  border-top: 10px solid red;
  & > p {
    display: grid;
    grid-template-columns: 1fr 5fr;
    margin: 0;
    border-bottom: 1px solid ${props => props.theme.offWhite};
    span {
      padding: 1rem;
      &:first-child {
        font-weight: 900;
        text-align: right;
      }
    }
  }
  & > h2 {
    text-align: center;
  }
`;

const Composed = adopt({
  user: ({ render }) => <User>{render}</User>,
  orders: ({ render }) => <Query query={ALL_ORDERS_QUERY}>{render}</Query>
});

const Account = props => (
  <Composed>
    {({ user, orders }) => {
      const { me } = user.data;
      const orderList = orders.data.orders;
      if (user.loading || orders.loading) return <p>Loading...</p>;
      if (user.error) return <Error error={user.error} />;
      if (orders.error) return <Error error={orders.error} />;

      return (
        <Container>
          <h2>Your Account</h2>
          <p>
            <span>Name:</span>
            <span>{me.name}</span>
          </p>
          <p>
            <span>Email:</span>
            <span>{me.email}</span>
          </p>
          <p>
            <span>Total Orders:</span>
            <span>
              {orderList ? (
                <Link href="/orders">
                  <a>
                    {orderList.length} order{orderList.length > 1 ? 's' : ''}
                  </a>
                </Link>
              ) : (
                0
              )}
            </span>
          </p>
        </Container>
      );
    }}
  </Composed>
);

export default Account;
