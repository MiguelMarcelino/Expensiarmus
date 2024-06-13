package com.spellshare.expensiarmus.dbconnector

import android.content.ContentValues.TAG
import android.util.Log
import com.spellshare.expensiarmus.data.ExpenseItem
import com.spellshare.expensiarmus.data.identifiers.IIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import java.util.UUID

class ExpenseConnector : Connector<ExpenseItem> {

    override fun <T : IIdentifier> getItem(identifier: T): ExpenseItem? {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<ExpenseItem?>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val document = db.collection("expenses").document(identifier.uid).get().await()
                val expense = document.toObject(ExpenseItem::class.java)
                deferred.complete(expense)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun getItems(): List<ExpenseItem> {
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<ExpenseItem>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("expenses").get().await()
                val expenses = documents.map { document ->
                    document.toObject(ExpenseItem::class.java)
                }
                deferred.complete(expenses)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }

    override fun addItem(expenseItem: ExpenseItem) {
        val db = FirebaseFirestore.getInstance()

        // Create a new expense object
        val expense = ExpenseItem(
            amount = expenseItem.amount,
            description = expenseItem.description,
            currency = expenseItem.currency,
            status = expenseItem.status,
            tags = expenseItem.tags,
            ownerId = expenseItem.ownerUid,
            groupId = expenseItem.groupUid
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

    override fun updateItem(expenseItem: ExpenseItem) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()

        expenseItem.amount?.let { updates["amount"] = it }
        expenseItem.description?.let { updates["description"] = it }
        expenseItem.currency?.let { updates["currency"] = it }
        expenseItem.status?.let { updates["status"] = it }
        expenseItem.tags?.let { updates["tags"] = it }
        expenseItem.ownerUid?.let { updates["ownerId"] = it }
        expenseItem.groupUid?.let { updates["groupId"] = it }

        // Update the document
        db.collection("expenses")
            .document(expenseItem.uid)
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