package com.example.expensiarmus.dbconnector

import android.content.ContentValues.TAG
import android.util.Log
import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.identifiers.ExpenseIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import java.util.UUID

object ExpenseConnector {

    fun getExpenses(): List<ExpenseItem> {
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

    fun addExpense(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: String,
        groupId: String
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a new expense object
        val expense = ExpenseItem(
            uid = UUID.randomUUID().toString(), // Generate uid for new ExpenseItem
            amount = amount,
            description = description,
            currency = currency,
            status = status,
            tags = tags,
            ownerId = ownerId,
            groupId = groupId
        )

        // Add a new document with a generated ID
        db.collection("expenses")
            .document(expense.uid)  // Use id as the document ID
            .set(expense)
            .addOnSuccessListener {
                Log.d(TAG, "Expense added successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error adding expense", e)
            }
    }

    fun updateExpense(
        expenseIdentifier: ExpenseIdentifier,
        amount: Double? = null,
        description: String? = null,
        currency: String? = null,
        status: String? = null,
        tags: String? = null,
        ownerId: Long? = null,
        groupId: Long? = null
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()

        amount?.let { updates["amount"] = it }
        description?.let { updates["description"] = it }
        currency?.let { updates["currency"] = it }
        status?.let { updates["status"] = it }
        tags?.let { updates["tags"] = it }
        ownerId?.let { updates["ownerId"] = it }
        groupId?.let { updates["groupId"] = it }

        // Update the document
        db.collection("expenses")
            .document(expenseIdentifier.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(TAG, "Expense updated successfully")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error updating expense", e)
            }
    }

    fun deleteExpense(
        expenseIdentifier: ExpenseIdentifier
    ) {
        val db = FirebaseFirestore.getInstance()

        // Delete the document with the specified ID
        db.collection("expenses")
            .document(expenseIdentifier.uid)
            .delete()
            .addOnSuccessListener {
                Log.d(TAG, "Expense deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error deleting expense", e)
            }
    }
}