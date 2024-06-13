package com.spellshare.expensiarmus.dbconnector

import android.content.ContentValues.TAG
import android.util.Log
import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.identifiers.IIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await

class ExpenseConnector : Connector<Expense> {

    override fun <T : IIdentifier> getItem(identifier: T): Expense? {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<Expense?>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val document = db.collection("expenses").document(identifier.uid).get().await()
                val expense = document.toObject(Expense::class.java)
                deferred.complete(expense)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun getItems(): List<Expense> {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<Expense>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("expenses").get().await()
                val expenses = documents.map { document ->
                    document.toObject(Expense::class.java)
                }
                deferred.complete(expenses)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun addItem(item: Expense) {
        val db = FirebaseFirestore.getInstance()

        // Create a new expense object
        val expense = Expense(
            amount = item.amount,
            description = item.description,
            currency = item.currency,
            status = item.status,
            tags = item.tags,
            ownerId = item.ownerUid,
            groupId = item.groupUid
        )

        // Add a new document with a generated ID
        db.collection("expenses")
            .add(expense)
            .addOnSuccessListener {
                Log.d(TAG, "Expense added successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error adding expense", e)
            }
    }

    override fun updateItem(item: Expense) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()

        item.amount.let { updates["amount"] = it }
        item.description?.let { updates["description"] = it }
        item.currency.let { updates["currency"] = it }
        item.status.let { updates["status"] = it }
        item.tags.let { updates["tags"] = it }
        item.ownerUid.let { updates["ownerId"] = it }
        item.groupUid.let { updates["groupId"] = it }

        // Update the document
        db.collection("expenses")
            .document(item.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(TAG, "Expense updated successfully")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error updating expense", e)
            }
    }

    override fun <T : IIdentifier> deleteItem(identifier: T) {
        val db = FirebaseFirestore.getInstance()

        // Delete the document with the specified ID
        db.collection("expenses")
            .document(identifier.uid)
            .delete()
            .addOnSuccessListener {
                Log.d(TAG, "Expense deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error deleting expense", e)
            }
    }
}