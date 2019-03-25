// These custom resolvers will be used for business logic
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { makeANiceEmail, transport } = require('../mail');
const { hasPermission } = require('../utils');
const stripe = require('../stripe');

const Mutations = {
  async createItem(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      throw new Error('You must be logged into do that');
    }

    const item = await ctx.db.mutation.createItem({
      data: {
        user: {
          connect: {
            // This is how you provide relationships
            // between the item and the user
            id: ctx.request.userId
          }
        },
        ...args,
      }
    }, info);

    console.log(item);
    return item;
  },
  updateItem(parent, args, ctx, info){
    // first take a copy of the updates
    const updates = { ...args };
    // remove the ID from the updates
    delete updates.id;
    // run the update method
    return ctx.db.mutation.updateItem({
      data: updates,
      where: {
        id: args.id
      }
    }, info);
  },
  async deleteItem(parent, args, ctx, info){
    const where = { id: args.id };
    // find the item
    const item = await ctx.db.query.item({ where }, `{ id title user { id } }`);
    // check if they own/have permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission => ['ADMIN', 'ITEMDELETE'].includes(permission))

    if (!ownsItem && !hasPermissions) {
      throw new Error('You don\' have permission');
    }
    // delete item
    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signUp(parent, args, ctx, info){
    args.email = args.email.toLowerCase(); // manage different cases of email address
    // Hash the password and check that it validates
    const password = await bcrypt.hash(args.password, 10);
    // ensure the user is the in the database
    const user = await ctx.db.mutation.createUser({
      data: {
        ...args,
        password,
        permissions: { set: ['USER'] }
      }
    }, info);
    // create jwt token for user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // Set the jwt as a cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year!
    });
    // return the user to the browser
    return user;
  },
  async signIn(parent, { email, password }, ctx, info){
    // 1- check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email }});
    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }
    // 2 - check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if(!valid) {
      throw new Error('Invalid password!');
    }
    // 3 - generate the jwt token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // 4 - set the cookie with the token
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // 5 - return user
    return user;
  },
  signOut(parent, args, ctx, info){
    ctx.response.clearCookie('token'); // Comes from cookieParser :D
    return { message: 'Goodbye!' };
  },
  async requestReset(parent, args, ctx, info){
  // check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email }});
    if (!user){
      throw new Error(`No such user for ${args.email}`);
    }
    // set a reset token + expiry for the token itself
    const promisifiedRandomBytes = promisify(randomBytes)
    const resetToken = (await promisifiedRandomBytes(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000 // 1 hour from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    })
    // send and email for the user with reset token
    const mailRes = await transport.sendMail({
      from: 'reset@SiqGarbs.com',
      to: user.email,
      subject: 'Your SiqGarbs Password Reset',
      html: makeANiceEmail(`Your password reset token is here
      \n\n <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click here to reset</a>`)
    })

    return { message: 'Thanks!' };

  },
  async resetPassword(parent, args, ctx, info){
    // 1 - check if the passwords match
    if (args.password !== args.confirmPassword) {
      throw new Error('Yo passwords don\'t match');
    }
    // 2 - check if its a legit resetToken
    // 3 - check if its expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      }
    });
    if (!user){
      throw new Error('This token is either invalid or expired!');
    }
    // 4 - hash their new password
    const password = await bcrypt.hash(args.password, 10);
    // 5 - save new password, and remove old resetToken fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null,
      }
    });
    // 6 - generate jwt
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7 - set the jwt cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // 8 - return new user
    return user;
  },
  async updatePermissions(parent, args, ctx, info) {
    // 1. check logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!');
    }
    // 2. query the current user
    const currentUser = await ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);
    // 3 check if they have permissions
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE'])
    // 4 update the permissions
    return ctx.db.mutation.updateUser({
      data: {
        permissions: {
          set: args.permissions
        }
      },
      where: {
        // args instead of ctx because you might be updating someone elses permissions
        id: args.userId
      }
    }, info)
  },
  async addToCart(parent, args, ctx, info){
    // 1. make sure they are sign in
    const { userId } =  ctx.request;
    if (!userId) {
      throw new Error('You must be signed in to add a item to the cart');
    }
    // 2. query the users current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id } // args.id is the item that were passing along
      }
    });
    // 3. check if that item is already in their cart and increment +1 if so
    if (existingCartItem){
      return ctx.db.mutation.updateCartItem({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + 1 }
      }, info);
    }
    // 4. if its not, create a fresh cartItem for that user
    return ctx.db.mutation.createCartItem({
      data: {
        user: {
          connect: { id: userId }
        },
        item: {
          connect: { id: args.id }
        }
      }
    }, info)
  },
  async removeFromCart(parent, args, ctx, info){
    // 1. Find cart item
    const cartItem = await ctx.db.query.cartItem({
      where: {
        id: args.id
      }
    }, `{ id, user { id } }`)
    // 1.5 Make sure we found an item
    if (!cartItem) throw new Error('No cartItem found!');
    // 2. Make sure they own that cart item
    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error('cheating huh?');
    }
    // 3. Delete that cart item
    return ctx.db.mutation.deleteCartItem({
      where: {
        id: args.id
      }
    }, info)
  },
  async createOrder(parent, args, ctx, info){
    // 1. query the current user and make sure they are signed in
    const { userId } = ctx.request;
    if (!userId) throw new Error('You must be signed in to complete this order');
    // 2. recalculate the total price (this prevents frontEnd price faking)
    const user = await ctx.db.query.user({ where: { id: userId } },`
      {
        id
        name
        email
        cart {
          id
          quantity
          item { title price id description image largeImage}
        }
      }
    `);
    const amount = user.cart.reduce((tally, cartItem) => tally + cartItem.item.price * cartItem.quantity, 0);
    // 3. create the stripe charge
    const charge = await stripe.charges.create({
      amount,
      currency: 'USD',
      source: args.token // getting passes from the FE
    });
    // 4. convert the cart items to order items
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } },
      }
      delete orderItem.id
      return orderItem;
    })
    // 5. create the order
    const order = await ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } }
      }
    });
    // 6. clear the user's cart, delete cartItems
    const cartItemIds = user.cart.map(cartItem => cartItem.id);
    await ctx.db.mutation.deleteManyCartItems({
      where:{
        id_in: cartItemIds
      }
    });
    // 7. return the order to the client
    return order;
  }
};

module.exports = Mutations;
