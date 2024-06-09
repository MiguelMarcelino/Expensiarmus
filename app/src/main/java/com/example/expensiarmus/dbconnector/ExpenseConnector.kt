package com.example.expensiarmus.dbconnector

import android.content.ContentValues.TAG
import android.util.Log
import com.example.expensiarmus.data.ExpenseItem
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore

class ExpenseConnector {

    fun addExpense(
        id: Long,
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: Long,
        groupId: Long
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a new expense object
        val expense = ExpenseItem(
            id = id,
            amount = amount,
            description = description,
            currency = currency,
            status = status,
            tags = tags,
            ownerId = ownerId,
            groupId = groupId,
            createdAt = Timestamp.now()  // Use current timestamp
        )

        // Add a new document with a generated ID
        db.collection("expenses")
            .document(id.toString())  // Use id as the document ID
            .set(expense)
            .addOnSuccessListener {
                Log.d(TAG, "Expense added successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error adding expense", e)
            }
    }

    fun updateExpense(
        id: Int,
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
            .document(id.toString())
            .update(updates)
            .addOnSuccessListener {
                Log.d(TAG, "Expense updated successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error updating expense", e)
            }
    }

    fun deleteExpense(
        id: Long
    ) {

        val db = FirebaseFirestore.getInstance()

        // Delete the document with the specified ID
        db.collection("expenses")
            .document(id.toString())
            .delete()
            .addOnSuccessListener {
                Log.d(TAG, "Expense deleted successfully")
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Error deleting expense", e)
            }
    }
}