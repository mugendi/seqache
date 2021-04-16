const crypto = require('crypto');


class Cache {
    constructor(options) {

        this.options = Object.assign({
            keyPrefix: "seqache",
            log: false,
            // default cache duration is one day
            ttl: 3600 * 24,
            maxSize: 1000
        }, options);

        // if we have no redis store passed, then we create our own
        if (!this.options.redis) {
            const Redis = require("ioredis");
            this.options.redis = new Redis();
        }

    }

    __get_cache_key(model) {
        //set database & tablename
        this.database = model.sequelize.config.database;
        this.tableName = model.tableName;

        // make values to be used in redis

        // the key is made of "prefix:database:table"
        this.hashKey = `${this.options.keyPrefix}:${this.database}:${this.tableName}`;

        // the hash field is an md5 hash of the query options as entered
        if (this.queryArgs)
            this.hashField = crypto.createHash('md5').update(JSON.stringify(this.queryArgs)).digest('hex');

    }

    ___log() {

        // if allowed to log and is isRawQuery
        if (this.options.log && this.isRawQuery) {
            let args = [`Seqcache >> `].concat(Array.from(arguments));
            console.log(...args);
        }



    }

    ___detete_hash() {

        let self = this;

        return new Promise((resolve, reject) => {
            this.options.redis.del(this.hashKey, function(err, resp) {
                if (err) return reject(err);

                // if we have purged anything
                if (resp) {
                    self.___log(`Purged cache for ${self.database}.${self.tableName}`)
                }
                resolve(resp ? true : false);
            });
        });

    }

    purge(model) {
        let self = this;
        //no query arguments here...
        this.queryArgs = null;
        // construct cache keys
        this.__get_cache_key(model);

        // delete this hash
        this.___detete_hash()



    }


    async find() {


        let self = this;

        let args = Array.from(arguments),
            // shift arguments by order, model, findMethod, ttl
            model = args.shift(),
            findMethod = args.shift(),
            ttl = args.shift(),
            maxSize = args.shift(),
            whereStr;



        // everything else should be considered as user entered arguments for the query
        this.queryArgs = args;
        whereStr = this.queryArgs[0].where ? " [ WHERE: " + JSON.stringify(this.queryArgs[0].where) + " ]" : "";

        // a little query validation 
        if (this.queryArgs.length < 1 && this.queryArgs[0] instanceof Object == false) {
            // what kind of query is this?
            throw new Error(`No Query entered!`)
        }

        // strategy: We only cache queries returning raw/json results so determine if this is raw
        this.isRawQuery = this.queryArgs[0].raw;


        if (this.isRawQuery) {

            // construct cache keys
            this.__get_cache_key(model);

            // console.log(this);

            // now check if keys exist in cache
            // we wrap redis call in a promise as we have no guarantee the user is using ioredis that supports promises
            let cachedResult = await new Promise((resolve, reject) => {

                    this.options.redis.hget(this.hashKey, this.hashField, function(err, resp) {
                        if (err) return reject(err);
                        // parse result back to JSON
                        resolve(JSON.parse(resp));
                    });

                })
                .catch(console.error);


            // if we have any cached result
            if (cachedResult) {
                this.___log(`Returning cached result for ${this.database}.${this.tableName}${whereStr}`);
                return cachedResult;
            }

        }

        // otherwise we need to run the query
        // here we ensure we run the correct function based on 'findMethod'
        // we also spread all the arguments contained in this.queryArgs

        return model['find' + findMethod](...this.queryArgs)
            .then((queryResponse) => {

                // now we must cache this response if this is a raw query
                if (this.isRawQuery) {

                    // we use a promise here so that we don't have to wait for caching before returning results
                    // it would be easy to use ioredis promises but there is no guarantee the user will use ioredis as the redis option
                    new Promise(async(resolve, reject) => {

                        // before we set a new field, see that we haven't reached max size
                        await new Promise((resolve, reject) => {
                            self.options.redis.hlen(self.hashKey, function(err, resp) {
                                if (err) return reject(err);

                                // if we have are 1 value off from maxSize, delete because adding this one will take us above maxSize
                                if (resp > maxSize - 1) {
                                    self.___detete_hash().then(resolve);
                                } else {
                                    resolve(resp)
                                }

                            })
                        });

                        // okay, let us save this result now
                        // we save as a JSON string
                        await self.options.redis.hset(self.hashKey, this.hashField, JSON.stringify(queryResponse));
                        // set expiry according to ttl
                        await self.options.redis.expire(self.hashKey, ttl);

                    });

                }

                this.___log(`Returning un-cached result for ${this.database}.${this.tableName}${whereStr}`);
                // return results
                return queryResponse;
            })
            .catch(console.error)



    }

    wrap(model, ttl, maxSize) {

        let self = this;

        // use default cache or user defined
        ttl = ttl || this.options.ttl;
        maxSize = maxSize || this.options.maxSize;

        // add cached methods
        // we use Object assign to ensure each method gets its own cache version. 
        //Otherwise we would just be updating the same value within the circular model objects
        model.cache = Object.assign({}, {
            findAll: self.find.bind(self, model, 'All', ttl, maxSize),
            findOne: self.find.bind(self, model, 'One', ttl, maxSize),
            purge: self.purge.bind(self, model)
        });


        let events = ["Update", "Create", "Destroy"];

        // add hooks to purge caches
        for (let event of events) {
            // bind afterUpdate, afterCreate, afterDestroy
            model['after' + event](model.cache.purge);
            // bind the bulk versions of the same events too
            model['afterBulk' + event](model.cache.purge);
        }



    }
}






module.exports = Cache