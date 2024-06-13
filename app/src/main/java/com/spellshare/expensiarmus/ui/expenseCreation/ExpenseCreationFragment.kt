package com.spellshare.expensiarmus.ui.expenseCreation

import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.identifiers.ExpenseIdentifier
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
import com.spellshare.expensiarmus.data.identifiers.UserIdentifier
import com.spellshare.expensiarmus.databinding.FragmentExpenseCreationBinding
import com.spellshare.expensiarmus.dbconnector.ExpenseConnector
import com.spellshare.expensiarmus.dbconnector.GroupConnector
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

    private var groupUid: String? = null

    private var expenseItem: Expense? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentExpenseCreationBinding.inflate(inflater, container, false)
        val root: View = binding.root

        expenseAmount = binding.expenseAmount
        expenseDescription = binding.expenseDescription
        expenseCurrency = binding.expenseCurrency
        expenseStatus = binding.expenseStatus
        expenseTags = binding.expenseTags
        saveButton = binding.saveButton

        val expenseConnector = ExpenseConnector()

        val uid = arguments?.getString("uid")
        val ownerUid = arguments?.getString("ownerUid")
        groupUid = arguments?.getString("groupUid")

        if (uid != null) {
            val identifier = ExpenseIdentifier(uid)
            expenseItem = expenseConnector.getItem(identifier)
            populateFields(expenseItem)
        }

        saveButton.setOnClickListener {
            try {
                createExpense(uid, ownerUid, groupUid, expenseConnector)
            } catch (e: RequiredDataException) {
                showToast(requireContext(), "Missing required data: ${e.message}")
            } catch (e: Exception) {
                showToast(requireContext(), "Error creating expense: ${e.message}")
            }
        }

        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {

        val groupConnector = GroupConnector()
        val memberIds = groupUid?.let {
            val group = groupConnector.getItem(GroupIdentifier(it))
            group?.userIds ?: emptyList()
        } ?: emptyList()


        val expenseShareLayout = view.findViewById<LinearLayout>(R.id.expenseShareLayout)

        // Dynamically add EditText fields for each member
        memberIds.forEach { memberId ->
            val textView = TextView(view.context)
            textView.layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            textView.text = "Member $memberId"

            val editText = EditText(view.context)
            editText.layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            editText.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            editText.hint = "Percentage for $memberId"

            expenseShareLayout.addView(textView)
            expenseShareLayout.addView(editText)
        }
    }

    private fun populateFields(expenseItem: Expense?) {
        expenseItem?.let {
            expenseAmount.setText(it.amount.toString())
            expenseDescription.setText(it.description)
            expenseCurrency.setText(it.currency)
            expenseStatus.setText(it.status)
            expenseTags.setText(it.tags.joinToString(", "))
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
                expenseShare = mapOf(), // TODO: Parse map from UI
                ownerIdentifier = UserIdentifier(ownerUid),
                groupIdentifier = GroupIdentifier(groupUid),
                userIdentifiers = emptyList() // TODO: Parse users from UI
            )
            expenseConnector.addItem(newExpenseItem)
            findNavController().navigateUp()
        } else if (expenseItem != null) {
            // We use the existing uid to update the item
            // The fields ownerId, groupId and createdAt are not updated
            val updatedExpenseItem = Expense(
                uid = uid,
                amount = expenseAmount.text.toString().toDouble(),
                description = expenseDescription.text.toString(),
                currency = expenseCurrency.text.toString(),
                status = expenseStatus.text.toString(),
                tags = listOf(expenseTags.text.toString()),
                expenseShare = mapOf(), // TODO: Parse map from UI
                ownerIdentifier = expenseItem!!.ownerIdentifier,
                groupIdentifier = expenseItem!!.groupIdentifier,
                userIdentifiers = expenseItem!!.userIdentifiers, // TODO: Parse users from UI
                createdAt = expenseItem!!.createdAt
            )
            expenseConnector.updateItem(updatedExpenseItem)
            findNavController().navigateUp()
        } else {
            throw RequiredDataException("Cannot update item, as not all required fields are present.")
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
