# seqache

Simple and effective redis cache for sequelize :)

## Why?

Caching modules for sequelize are very complicated. I wanted something easy that implements the following basic strategy.

-   Cache all findAll and findOne queries per model.
-   Have model level TTL (time to live) values so different models can be cached differently.
-   Automatically invalidate/purge caches whenever an update/insert/delete command is run on the model
-   Use redis. Yes, because what else is there to use?

## Using Seqache

Install:

` npm install --save seqache` or `yar add seqache`.

Require and initialize.

```javascript
let Cache = require('seqache');
let options = {
    redis: myRedisInstance,
    log: true,
    keyPrefix: 'seqache',
    maxSize: 1000,
};
let cache = new Cache(options);
```

## All Options

### `redis`

Type: `Object`<br>
Expects an instance of [redis](https://www.npmjs.com/package/redis) or [ioredis](https://www.npmjs.com/package/ioredis)

Defaults to ioredis with default redis port and database.

### `log`

Type: `Boolean|Function`<br>
A function used to print your logs or simply `true` to enable default (`console.log`) logging or `false` to disable logging.

Default is **false**

### `keyPrefix`

Type: `String`<br>
A string used to prefix all keys as they are cached.

Default is **seqache**

### `maxSize`

Type: `Integer`<br>
Caches can balloon in size. Set maximum redis hash size.

Default is **1000**

This global option can be overridden for each model.

### `ttl`

Type: `Integer`<br>
Total time to live. This determines how long a cache is kept. Value is in seconds as it uses `redis.expire` method.

Default is **86,400**.

This global option can be overridden for each model.

## Wrapping your models

Seqache works by adding special cache methods to your sequelize models. To do so, you need to `wrap` the models as shown below.

```javascript
    // sequelize initialization & other code
    ...
    // our model
    const User = sequelize.define('User', {
        // Model attributes are defined here
        firstName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING
            // allowNull defaults to true
        }
        }, {
        // Other model options go here
        hooks : {...}
    });

    // wrap the model
    cache.wrap(User, [ttl, maxSize]);


```

Wrapping a model adds the `.cache` key to the model object. `.cache` contains the convenience methods `findOne`, `findAll` and `purge`, all of which return promises.

**NOTE:**
You can pass model level `ttl` and `maxSize` values while wrapping a model.

These will be respected and used for caching that model only!

## Querying With Cache
To see how seqache improves your cached queries, simply do the following:

```javascript
// findAll
User.cache.findAll().then(console.log).catch(console.error);

// findOne
User.cache.findOne().then(console.log).catch(console.error);

// in case you want to purge the cache for any reason
User.cache.purge().then(console.log).catch(console.error);
```

## NOTE:

Wrapping your model adds extra `afterUpdate`, `afterDestroy` and `afterCreate` hooks that are used to purge model caches. 

As a result, you almost will never need to manually run `.cache.purge()` as it is done automagically for you whenever the data changes.

These hooks do not override your other hooks so sequelize functions exactly as expected.

___

Also, under the hood, `cache.findAll` and `cache.FindOne` run the respective sequelize functions and pass all your intended parameters. No monkey patching or other shenanigans :)

___

**When using **paranoid** tables, `AfterDestroy` hooks are not triggered as expected. This issue has been extensively discussed [Here](https://github.com/sequelize/sequelize/issues/9318). You will need to add `individualHooks:true` to force the hook to fire. This is important because the hook is used to invalidate old caches. See example below.**

```javascript
User.destroy({
    where: {
        id: 1234,
    },
    individualHooks: true,
});
```

Overall, this is **very good practice** as even in associations, it escalates individual hooks across all affected models which in turn invalidates all related caches!


## Contributing

I need your support. Hit me up and let's make this a better module!
