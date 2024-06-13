package com.spellshare.expensiarmus.ui.expenseCreation

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.identifiers.ExpenseIdentifier
import com.spellshare.expensiarmus.databinding.FragmentExpenseCreationBinding
import com.spellshare.expensiarmus.dbconnector.ExpenseConnector
import com.spellshare.expensiarmus.exceptions.RequiredDataException

class ExpenseCreationFragment : Fragment() {

    private var _binding: FragmentExpenseCreationBinding? = null

    private val binding get() = _binding!!

    private lateinit var expenseAmount: EditText
    private lateinit var expenseDescription: EditText
    private lateinit var expenseCurrency: EditText
    private lateinit var expenseStatus: EditText
    private lateinit var expenseTags: EditText
    private lateinit var saveButton: Button

    private var expenseItem: Expense? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentExpenseCreationBinding.inflate(inflater, container, false)
        val root: View = binding.root

        expenseAmount = root.findViewById(R.id.expenseAmount)
        expenseDescription = root.findViewById(R.id.expenseDescription)
        expenseCurrency = root.findViewById(R.id.expenseCurrency)
        expenseStatus = root.findViewById(R.id.expenseStatus)
        expenseTags = root.findViewById(R.id.expenseTags)
        saveButton = root.findViewById(R.id.saveButton)

        val expenseConnector = ExpenseConnector()

        val uid = arguments?.getString("uid")
        val ownerUid = arguments?.getString("ownerUid")
        val groupUid = arguments?.getString("groupUid")

        if (uid != null) {
            val identifier = ExpenseIdentifier(uid)
            expenseItem = expenseConnector.getItem(identifier)
            populateFields(expenseItem)
        }

        saveButton.setOnClickListener {
            try {
                createExpense(uid, ownerUid, groupUid, expenseConnector)
            } catch (e: Exception) {
                showToast(requireContext(), "Error creating expense: ${e.message}")
            }
        }

        return root
    }

    private fun populateFields(expenseItem: Expense?) {
        expenseItem?.let {
            expenseAmount.setText(it.amount.toString())
            expenseDescription.setText(it.description)
            expenseCurrency.setText(it.currency)
            expenseStatus.setText(it.status)
            expenseTags.setText(it.tags.toString())
        }
    }

    private fun createExpense(
        uid: String?,
        ownerUid: String?,
        groupUid: String?,
        expenseConnector: ExpenseConnector
    ) {
        if (ownerUid == null || groupUid == null) {
            // We need the ownerUid and groupUid to create a new item
            throw RequiredDataException("Owner and group UIDs are required to create a new expense item")
        } else if (uid == null) {
            // When uid is null, we create a new item
            val newExpenseItem = Expense(
                amount = expenseAmount.text.toString().toDouble(),
                description = expenseDescription.text.toString(),
                currency = expenseCurrency.text.toString(),
                status = expenseStatus.text.toString(),
                tags = expenseTags.text.toString().split(","),
                ownerId = ownerUid,
                groupId = groupUid
            )
            expenseConnector.addItem(newExpenseItem)
        } else {
            // We use the existing uid to update the item
            // The fields ownerId, groupId and createdAt are not updated
            val updatedExpenseItem = Expense(
                uid = uid,
                amount = expenseAmount.text.toString().toDouble(),
                description = expenseDescription.text.toString(),
                currency = expenseCurrency.text.toString(),
                status = expenseStatus.text.toString(),
                tags = listOf(expenseTags.text.toString()),
                ownerUid = expenseItem!!.ownerUid,
                groupUid = expenseItem!!.groupUid,
                createdAt = expenseItem!!.createdAt
            )
            expenseConnector.updateItem(updatedExpenseItem)
        }
    }

    fun showToast(context: Context, message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
