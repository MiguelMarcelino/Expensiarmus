package com.example.expensiarmus.dbconnector

import android.content.ContentValues
import android.util.Log
import com.example.expensiarmus.data.User
import com.example.expensiarmus.data.identifiers.IIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await

object UserConnector: Connector<User> {

    override fun getItems(): List<User> {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<User>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("users").get().await()
                val users = documents.map { document ->
                    document.toObject(User::class.java)
                }
                deferred.complete(users)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun addItem(item: User) {
        val db = FirebaseFirestore.getInstance()

        // Add a new document with a generated ID
        db.collection("users")
            .document(item.uid)  // Use id as the document ID
            .set(item)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "User added successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error adding user", e)
            }
    }

    override fun updateItem(user: User) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()
        user.userName?.let { updates["name"] = it }
        user.email?.let { updates["email"] = it }
        user.gender?.let { updates["gender"] = it }

        // Update the document
        db.collection("users")
            .document(user.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "User updated successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error updating user", e)
            }
    }

    override fun <T : IIdentifier> deleteItem(identifier: T) {
        val db = FirebaseFirestore.getInstance()

        // Delete the document
        db.collection("users")
            .document(identifier.uid)
            .delete()
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "User deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error deleting user", e)
            }
    }
}