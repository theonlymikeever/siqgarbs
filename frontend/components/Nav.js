import Link from 'next/link';
import NavStyle from './styles/NavStyles';
import { Mutation } from 'react-apollo';
import { selectLimit } from 'async';
import { TOGGLE_CART_MUTATION } from '../components/Cart';
import User from './User';
import SignOut from './SignOut';
import CartCount from './CartCount';

const Nav = () => (
  <User>
    {({ data: { me } }) => (
      <NavStyle data-test="nav">
        <Link href="/items">
          <a>Shop</a>
        </Link>
        { me && (
          <>
            <Link href="/sell">
              <a>Sell</a>
            </Link>
            <Link href="/orders">
              <a>Orders</a>
            </Link>
            <Link href="/account">
              <a>Me</a>
            </Link>
            <SignOut />
            <Mutation mutation={TOGGLE_CART_MUTATION}>
            {(toggleCart) => (
              <button onClick={toggleCart}>
                My Cart
                <CartCount count={me.cart.reduce((tally, cartItem) => tally + cartItem.quantity, 0)} />
              </button>
            )}
            </Mutation>
          </>
        )}
        { !me && (
          <Link href="/signup">
            <a>Sign In</a>
          </Link>
        )}
      </NavStyle>
    )}
  </User>
);

export default Nav;
