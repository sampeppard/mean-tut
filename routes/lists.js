var express = require('express');
var router = express.Router();

var _ = require('lodash');
var mongoose = require('mongoose');
var debug = require('debug')('server');
var Promise = require('bluebird');

/*======DEFINE MONGOOSE SCHEMAS==============================================*/
//TODO: Pull out model definitions into seperate file

var ingredientSchema = mongoose.Schema({
    ingredientName: String
}, { _id: false });

var listSchema = mongoose.Schema({
    listName: String,
    ingredients: [ingredientSchema]
});

/*======CONFIG MONGODB =======================================================*/

// Go get your configuration settings from .env
var config = require('../config.js');
debug("Mongo is available at", config.mongoServer, ":", config.mongoPort);

// Set Promises library for Mongoosejs
mongoose.Promise = Promise;
var mongooseOptions = {
    promiseLibrary: Promise
};

// Connect to MongoDB through Mongoose and grab documents
var lists = null;
 var List = null;
var mongoURI = config.mongoURI;
debug("Attempting connection to mongo @", mongoURI);


//TODO: Importing all data at once would never scale. Define query modifier as
// callback function with mongoose model objects (promise style syntax)
//NOTE: Be careful with async here! Concurrency problems can occur

var mongoConnection = mongoose.createConnection(mongoURI, mongooseOptions);

mongoConnection.on('error', function(err) {
    debug("ERROR:", err);
});

mongoConnection.once('open', function(){
    debug("Connected correctly to server");
    mongoConnection.db.listCollections().toArray(function(err, collections) {
        if (err) {
            debug("ERROR:", err);
        }
        else {
            for (var c in collections) {
                debug("Found collection", collections[c]);
            }
        }
    });

    List = mongoConnection.model('List', listSchema);
    lists = List.find(function(err, documents) {
        if (err) {
            debug("onMongoConnectFail--ERROR:", err);
        }
        else {
            debug("onMongoConnectSuccess:", documents);
        }
    });
});

/*===============API ENDPOINTS===================*/

// INDEX
router.get('/', function(req, res, next) {
    res.send('INDEX PAGE');
});


/*------------MIDDLEWARE--------------*/

// MIDDLEWARE FOR ROUTES WITH DYNAMIC listID
router.param('listId', function(req, res, next, listId) {
    debug("listId found:", listId);
    if (mongodb.ObjectId.isValid(listId)) {
        List.findById(listId)
        .then(function(list) {
            debug("Found", list.listName);
            req.list = list;
            next();
        });
    }
    else {
        res.status(404).jsonp({ message: 'ID ' + listId + ' not found'});
    }
});

/*------------MIDDLEWARE-----------------------------------------------------*/

/*-----------MIDDLEWARE DEPENDENT FUNCTIONS----------------------------------*/

//NOTE: ORDER OF DEFINITION MATTERS!! If callback is defined after endpoint then
// route definition does not know that it is a callback
// Endpoint for get individual lists
var getList = function(req, res) {
    res.status(200).jsonp(req.list);
};
router.get('/lists/:listId', getList);

// update list
var updateList = function(req, res) {
    debug("Updating", req.list, "with", req.body);
    _.merge(req.list, req.body);
    lists.updateOne({"_id":req.list._id}, req.list, function(err, result) {
        if (err) {
            res.status(500).jsonp(err);
        }
        else
        {
            res.status(200).jsonp(result);
        }
    });
};
router.put('/lists/listId', updateList);

// delete route
var deleteList = function(req, res) {
    debug("Removing", req.list.listName, req.list.ingredients);
    lists.deleteOne({"_id": req.list._id}, function(err, result)
    {
        if (err) {
            debug("deleteList: ERROR:", err);
            res.status(500).jsonp(err);
        }
        else
        {
            res.list._id = undefined;
            res.status(200).jsonp(req.list);
        }
    });
};
router.delete('/lists/listId', deleteList);

/*-----------MIDDLEWARE DEPENDENT FUNCTIONS----------------------------------*/

// Set up endpoint to grab all lists
var getAllLists = function(req, res) {
    List.find(function(err, lists) {
        if (err) {
            debug("getAllLists--ERROR:", err);
            res.status(500).jsonp(err);
        }
        else {
            debug("getAllLists:", lists);
            res.status(200).jsonp(lists);
        }
    });
};
router.get('/lists', getAllLists);

// add list
var insertList = function(req, res) {
    var list = req.body;
    debug("Received", list);
    // MongoDB will create identifier field _id primary key

    //NOTE: insertList function will terminate BEFORE database insert completes!
    // DO NOT CALL res OUTSIDE OF CALLBACK TO MAKE SURE DB INSERT HAPPENS FIRST
    lists.insert(list, function(err, result) {
        if (err) {
            res.status(500).jsonp(err);
        }
        else {
            res.status(200).jsonp(list);
        }
        debug("INSIDE CALLBACK", list);
    });

    debug("OUTSIDE CALLBACK", list);
};
router.post('/lists', insertList);

module.exports = router;
