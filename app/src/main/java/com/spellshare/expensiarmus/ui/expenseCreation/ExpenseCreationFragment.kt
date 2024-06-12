package com.spellshare.expensiarmus.ui.expenseCreation

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.ExpenseItem
import com.spellshare.expensiarmus.data.identifiers.ExpenseIdentifier
import com.spellshare.expensiarmus.databinding.FragmentExpenseCreationBinding
import com.spellshare.expensiarmus.databinding.FragmentGroupBinding
import com.spellshare.expensiarmus.databinding.FragmentGroupDetailBinding
import com.spellshare.expensiarmus.dbconnector.ExpenseConnector

class ExpenseCreationFragment : Fragment() {

    private var _binding: FragmentExpenseCreationBinding? = null

    private val binding get() = _binding!!

    private lateinit var expenseAmount: EditText
    private lateinit var expenseDescription: EditText
    private lateinit var expenseCurrency: EditText
    private lateinit var expenseStatus: EditText
    private lateinit var expenseTags: EditText
    private lateinit var saveButton: Button

    private var expenseItem: ExpenseItem? = null

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
            if (expenseItem == null) {
                val newExpenseItem = ExpenseItem(
                    amount = expenseAmount.text.toString().toDouble(),
                    description = expenseDescription.text.toString(),
                    currency = expenseCurrency.text.toString(),
                    status = expenseStatus.text.toString(),
                    tags = expenseTags.text.toString(),
                    ownerId = ownerUid!!,
                    groupId = groupUid!!
                )
                expenseConnector.addItem(newExpenseItem)
            } else {
                // We use the existing uid to update the item
                // The fields ownerId, groupId and createdAt are not updated
                val updatedExpenseItem = ExpenseItem(
                    uid = uid!!,
                    amount = expenseAmount.text.toString().toDouble(),
                    description = expenseDescription.text.toString(),
                    currency = expenseCurrency.text.toString(),
                    status = expenseStatus.text.toString(),
                    tags = expenseTags.text.toString(),
                    ownerUid = expenseItem!!.ownerUid,
                    groupUid =  expenseItem!!.groupUid,
                    createdAt = expenseItem!!.createdAt
                )
                expenseConnector.updateItem(updatedExpenseItem)
            }
        }

        return root
    }

    private fun populateFields(expenseItem: ExpenseItem?) {
        expenseItem?.let {
            expenseAmount.setText(it.amount.toString())
            expenseDescription.setText(it.description)
            expenseCurrency.setText(it.currency)
            expenseStatus.setText(it.status)
            expenseTags.setText(it.tags)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
