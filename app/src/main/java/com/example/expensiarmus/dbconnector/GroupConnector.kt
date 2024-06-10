package com.example.expensiarmus.dbconnector

import android.content.ContentValues
import android.util.Log
import com.example.expensiarmus.data.GroupItem
import com.example.expensiarmus.data.identifiers.GroupIdentifier
import com.example.expensiarmus.data.identifiers.UserIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import java.util.UUID

object GroupConnector {

    fun getGroups(): List<GroupItem> {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<GroupItem>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("groups").get().await()
                val groups = documents.map { document ->
                    document.toObject(GroupItem::class.java)
                }
                deferred.complete(groups)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    fun createGroup(
        name: String,
        description: String?,
        ownerIdentifier: UserIdentifier
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a new group object
        val group = GroupItem(
            uid = UUID.randomUUID().toString(), // Generate uid for new GroupItem
            name = name,
            description = description,
            ownerUid = ownerIdentifier.uid
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

    fun updateGroup(
        groupIdentifier: GroupIdentifier,
        name: String? = null,
        description: String? = null,
        ownerIdentifier: UserIdentifier? = null
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()
        name?.let { updates["name"] = it }
        description?.let { updates["description"] = it }
        ownerIdentifier?.let { updates["ownerUid"] = it.uid }

        // Update the document
        db.collection("groups")
            .document(groupIdentifier.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "Group updated successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error updating group", e)
            }
    }

    fun deleteGroup(groupIdentifier: GroupIdentifier) {
        val db = FirebaseFirestore.getInstance()

        // Delete the document
        db.collection("groups")
            .document(groupIdentifier.uid)
            .delete()
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "Group deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error deleting group", e)
            }
    }
}