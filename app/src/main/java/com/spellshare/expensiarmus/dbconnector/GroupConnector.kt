package com.spellshare.expensiarmus.dbconnector

import android.content.ContentValues
import android.util.Log
import com.spellshare.expensiarmus.data.Group
import com.spellshare.expensiarmus.data.identifiers.IIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import java.util.UUID

class GroupConnector : Connector<Group> {

    override fun <T : IIdentifier> getItem(identifier: T): Group? {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<Group?>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val document = db.collection("groups").document(identifier.uid).get().await()
                val group = document.toObject(Group::class.java)
                deferred.complete(group)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun getItems(): List<Group> {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<Group>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("groups").get().await()
                val groups = documents.map { document ->
                    document.toObject(Group::class.java)
                }
                deferred.complete(groups)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun addItem(item: Group) {
        val db = FirebaseFirestore.getInstance()

        // Create a new group object
        val group = Group(
            uid = UUID.randomUUID().toString(), // Generate uid for new GroupItem
            name = item.name,
            description = item.description,
            ownerUid = item.ownerUid,
            userIds = item.userIds
        )

        // Add a new document with a generated ID
        db.collection("groups")
            .document(group.uid)  // Use id as the document ID
            .set(group)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "Expense added successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error adding expense", e)
            }
    }

    override fun updateItem(item: Group) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()
        item.name.let { updates["name"] = it }
        item.description?.let { updates["description"] = it }
        item.ownerUid.let { updates["ownerUid"] = it }

        // Update the document
        db.collection("groups")
            .document(item.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "Group updated successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error updating group", e)
            }
    }

    override fun <T : IIdentifier> deleteItem(identifier: T) {
        val db = FirebaseFirestore.getInstance()

        // Delete the document
        db.collection("groups")
            .document(identifier.uid)
            .delete()
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "Group deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error deleting group", e)
            }
    }
}