package main

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

const dbName = "test"

func initRoom(mongoClient *mongo.Client, c *Client) {
	roomsCollection := mongoClient.Database(dbName).Collection("rooms")
	usersRoomsCollection := mongoClient.Database(dbName).Collection("usersRooms")

	// start transaction
	opts := options.Session().SetDefaultReadConcern(readconcern.Majority())
	sess, err := mongoClient.StartSession(opts)
	if err != nil {
		log.Fatal(err)
	}
	defer sess.EndSession(context.TODO())

	txnOpts := options.Transaction().SetReadPreference(readpref.PrimaryPreferred())
	res, err := sess.WithTransaction(context.TODO(), func(sessCtx mongo.SessionContext) (interface{}, error) {
		// create room
		resRooms, errRooms := roomsCollection.InsertOne(sessCtx, bson.M{})
		if errRooms != nil {
			return nil, errRooms
		}

		// attempt to join user to the room
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
}

func joinRoom(mongoClient *mongo.Client, c *Client, joinRoomId string) {
	roomsCollection := mongoClient.Database(dbName).Collection("rooms")
	usersRoomsCollection := mongoClient.Database(dbName).Collection("usersRooms")

	// start transaction
	opts := options.Session().SetDefaultReadConcern(readconcern.Majority())
	sess, err := mongoClient.StartSession(opts)
	if err != nil {
		log.Fatal(err)
	}
	defer sess.EndSession(context.TODO())

	txnOpts := options.Transaction().SetReadPreference(readpref.Primary())
	res, err := sess.WithTransaction(context.TODO(), func(sessCtx mongo.SessionContext) (interface{}, error) {
		var room bson.M
		joinRoomObjectId, err := primitive.ObjectIDFromHex(joinRoomId)
		if err != nil {
			return nil, err
		}
		// find room that user wants to join
		err = roomsCollection.FindOne(sessCtx,
			bson.D{primitive.E{Key: "_id", Value: joinRoomObjectId}}).Decode(&room)
		if err != nil {
			return nil, err
		}
		// TODO: validations to whether the user can join the room
		// 1. user is already in the room

		// attempt to join user to the room
		resUsersRooms, errUsersRooms := usersRoomsCollection.InsertOne(sessCtx, bson.M{
			"roomId": room["_id"],
			"userId": c.userId,
		})
		return resUsersRooms, errUsersRooms
	}, txnOpts)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("%+v\n", res)
}

func watchRoom(mongoClient *mongo.Client, c *Client, joinRoomId string) {
	roomsCollection := mongoClient.Database(dbName).Collection("rooms")
	roomId, err := primitive.ObjectIDFromHex(joinRoomId)
	matchStage := bson.D{
		primitive.E{Key: "$match", Value: bson.D{
			primitive.E{Key: "documentKey", Value: bson.D{
				primitive.E{Key: "_id", Value: roomId}},
			}},
		}}
	opts := options.ChangeStream().SetFullDocument(options.UpdateLookup)
	changeStream, err := roomsCollection.Watch(context.TODO(), mongo.Pipeline{matchStage}, opts)
	if err != nil {
		log.Fatal(err)
	}

	go func() {
		for {
			if changeStream.TryNext(context.TODO()) {
				var event bson.M
				if err := changeStream.Decode(&event); err != nil {
					log.Fatal(err)
				}
				jsonEvent, err := bson.MarshalExtJSON(event, true, true)
				if err != nil {
					log.Fatal(err)
				}
				c.send <- jsonEvent
				continue
			}

			// If TryNext returns false, the next change is not yet available, the change stream was closed by the server,
			// or an error occurred. TryNext should only be called again for the empty batch case.
			if err := changeStream.Err(); err != nil {
				log.Fatal(err)
			}
			if changeStream.ID() == 0 {
				break
			}
		}
	}()
}
