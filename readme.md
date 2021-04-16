
# Why?

Caching modules for sequelize are very complicated. I wanted something easy that implements the following basic strategy.

- Cache all findAll and findOne queries per model.
- Have model level TTL (time to live) values so different models can be cached differently.
- Automatically invalidate/purge caches whenever an update/insert/delete command is run on the model
- Use redis. Yes, because what else is there to use? 

## Using Seqache

Install:

``` npm install --save seqache``` or ```yar add seqache```.

Require and initialize.

```javascript
    let Cache = require("seqache");
    let options = {
        redis : myRedisInstance,
        log: true,
        keyPrefix : 'seqache',
        maxSize : 
    }
    let cache = new Cache(options)

```

## All Options


### ```redis```
set your redis instance. 

Defaults to ioredis with default port and DB.

### ```log```
if you want any logs. 

Default is **false**

### ```keyPrefix```
how do you want your redis keys prefixed? 

Default is **seqache**

### ```maxSize```
Caches can balloon in size. Set maximum redis hash size.

Default is **1000**

This global option can be overridden for each model.

### ```ttl```
Total time to live. This determines how long a cache is kept. Value is in seconds as it uses ```redis.expire``` method.

Default is **86,400**.

This global option can be overridden for each model.

### Wrapping your models
Now Wrap all your Sequalize models:

```javascript

    ...
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

    // wrap model
    cache.wrap(User, [ttl, maxSize]);


```

Wrapping a model adds the ```.cache``` key to the model. This key contains the convenience methods ```findOne```, ```findAll``` and ```purge```, all of which return promises.

**NOTE:**
You can pass model level ``ttl`` and ```maxSize``` values while wrapping a model. 

These will be respected and used for caching that model only!

### Querying

To query, simply do the following:

```javascript

    // findAll
    User.cache.findAll()
        .then(console.log)
        .catch(console.error);

    // findOne
    User.cache.findOne()
        .then(console.log)
        .catch(console.error);

    User.cache.purge()
        .then(console.log)
        .catch(console.error);

```

**NOTE:** 

Wrapping your model adds extra ```afterUpdate```, ```afterDestroy``` and ```afterCreate``` hooks that are used to purge model caches. These hooks do not override your other hooks so sequelize functions exactly as expected.

Also, under the hood, ```cache.findAll``` and ```cache.FindOne``` run the respective sequelize functions and pass all your intended parameters. No monkey patching or other shenanigans :)


## Contributing
I need your support. Hit me up and let's make this a better module!


