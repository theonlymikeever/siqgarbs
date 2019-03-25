const { forwardTo } = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {
  // If you the query is exactly the same as it would be in prisma
  // you can forward through yoga as so:
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
  me(parent, args, ctx, info){
    // check if there is a current userId
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);
  },
  async users(parent, args, ctx, info){
    // 1. check if theyre logged in
    if (!ctx.request.userId){
      throw new Error('You must be logged in');
    }
    // 2. check if the users the permissions to query users
    hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);
    // 2. if they do, query all the users
    return ctx.db.query.users({}, info) // info will contain the graphql query from the frontend
  },
  async order(parent, args, ctx, info){
    // 1 make sure they are logged in
    if (!ctx.request.userId) throw new Error('You are not logged in');
    // 2 query the current order
    const order = await ctx.db.query.order({
      where: { id: args.id }
    }, info)
    // 3 check if they have the permissions to see order
    const ownsOrder = order.user.id === ctx.request.userId;
    const hasPermissionToSeeOrder = ctx.request.user.permissions.includes('ADMIN');
    if (!ownsOrder && !hasPermissionToSeeOrder) {
      throw new Error('You can\'t see this bud. It\'s not your order.');
    }
    // 4 return order
    return order;
  },
  async orders(parent, args, ctx, info){
    // 1. make sure they are logged in
    const { userId } = ctx.request;
    if (!userId) throw new Error('You are not logged in!');
    // 2. query the orders for the users
    const orders = await ctx.db.query.orders({ where: {
      user: { id: userId }
    }}, info)
    // 3. return order
    return orders;
  }
  // Otherwise you can write a custom func:
  // async items(parent, args, ctx, info){
  //   const items = await ctx.db.query.items();
  //   return items;
  // }
};

module.exports = Query;
