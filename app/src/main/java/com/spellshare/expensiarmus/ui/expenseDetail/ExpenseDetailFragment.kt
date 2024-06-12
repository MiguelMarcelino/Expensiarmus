package com.spellshare.expensiarmus.ui.expenseDetail

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
import com.spellshare.expensiarmus.databinding.FragmentGroupBinding
import com.spellshare.expensiarmus.dbconnector.ExpenseConnector

class ExpenseDetailFragment : Fragment() {

    private var _binding: FragmentGroupBinding? = null

    // This property is only valid between onCreateView and
    // onDestroyView.
    private val binding get() = _binding!!

    private lateinit var expenseUid: EditText
    private lateinit var expenseAmount: EditText
    private lateinit var expenseDescription: EditText
    private lateinit var expenseCurrency: EditText
    private lateinit var expenseStatus: EditText
    private lateinit var expenseTags: EditText
    private lateinit var expenseOwnerUid: EditText
    private lateinit var expenseGroupUid: EditText
    private lateinit var expenseCreatedAt: TextView
    private lateinit var saveButton: Button

    private var expenseItem: ExpenseItem? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentGroupBinding.inflate(inflater, container, false)
        val root: View = binding.root

        expenseUid = root.findViewById(R.id.expenseUid)
        expenseAmount = root.findViewById(R.id.expenseAmount)
        expenseDescription = root.findViewById(R.id.expenseDescription)
        expenseCurrency = root.findViewById(R.id.expenseCurrency)
        expenseStatus = root.findViewById(R.id.expenseStatus)
        expenseTags = root.findViewById(R.id.expenseTags)
        expenseOwnerUid = root.findViewById(R.id.expenseOwnerUid)
        expenseGroupUid = root.findViewById(R.id.expenseGroupUid)
        expenseCreatedAt = root.findViewById(R.id.expenseCreatedAt)
        saveButton = root.findViewById(R.id.saveButton)

        val expenseConnector = ExpenseConnector()

        val uid = arguments?.getString("uid")

        if (uid != null) {
            val identifier = ExpenseIdentifier(uid)
            expenseItem = expenseConnector.getItem(identifier)
            populateFields(expenseItem)
        }

        saveButton.setOnClickListener {
            expenseItem?.let { item ->
                expenseConnector.addItem(item)
            }
        }

        return root
    }

    private fun populateFields(expenseItem: ExpenseItem?) {
        expenseItem?.let {
            expenseUid.setText(it.uid)
            expenseAmount.setText(it.amount.toString())
            expenseDescription.setText(it.description)
            expenseCurrency.setText(it.currency)
            expenseStatus.setText(it.status)
            expenseTags.setText(it.tags)
            expenseOwnerUid.setText(it.ownerUid)
            expenseGroupUid.setText(it.groupUid)
            expenseCreatedAt.text = it.createdAt.toDate().toString()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
