package main

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func initRoom(mongoClient *mongo.Client, c *Client) error {
	dbName := "test"
	roomsCollection := mongoClient.Database(dbName).Collection("rooms")
	usersRoomsCollection := mongoClient.Database(dbName).Collection("usersRooms")

	// start transaction
	// 1. create a room
	// 2. create usersRooms
	// end transaction
	opts := options.Session().SetDefaultReadConcern(readconcern.Majority())
	sess, err := mongoClient.StartSession(opts)
	if err != nil {
		log.Fatal(err)
	}
	defer sess.EndSession(context.TODO())

	txnOpts := options.Transaction().SetReadPreference(readpref.PrimaryPreferred())
	res, err := sess.WithTransaction(context.TODO(), func(sessCtx mongo.SessionContext) (interface{}, error) {
		resRooms, errRooms := roomsCollection.InsertOne(sessCtx, bson.M{})
		if errRooms != nil {
			return nil, errRooms
		}
		resUsersRooms, errUsersRooms := usersRoomsCollection.InsertOne(sessCtx, bson.M{
			"roomId": resRooms.InsertedID,
			"userId": c.userId,
		})
		if errUsersRooms != nil {
			return nil, errUsersRooms
		}
		return [2]*mongo.InsertOneResult{resRooms, resUsersRooms}, nil
	}, txnOpts)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("%+v\n", res)

	return nil
}
