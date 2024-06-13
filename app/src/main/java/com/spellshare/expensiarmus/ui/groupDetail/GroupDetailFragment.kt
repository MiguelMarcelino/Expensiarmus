package com.spellshare.expensiarmus.ui.groupDetail

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.ExpenseItem
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
import com.spellshare.expensiarmus.databinding.FragmentGroupDetailBinding
import com.spellshare.expensiarmus.dbconnector.GroupExpenseConnector


class GroupDetailFragment : Fragment() {

    private var _binding: FragmentGroupDetailBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentGroupDetailBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val uid = arguments?.getString("uid")
        val name = arguments?.getString("name")
        val description = arguments?.getString("description")
        val ownerUid = arguments?.getString("ownerUid")

        binding.textId.text = uid
        binding.textName.text = name
        binding.textDescription.text = description

        binding.fab.setOnClickListener {
            // We pass the UID to search for the existing expense
            val bundle = Bundle().apply {
                putString("groupUid", uid)
                putString("ownerUid", ownerUid)
            }
            findNavController().navigate(R.id.action_nav_group_detail_to_nav_expense_detail, bundle)
        }

        // Get group expenses and display them
        uid?.let { groupId ->
            val expenses = GroupExpenseConnector.getExpenseForGroup(GroupIdentifier(groupId))
            displayExpenses(expenses)
        }

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun displayExpenses(expenses: List<ExpenseItem>) {
        val adapter = ExpenseAdapter(expenses)
        binding.recyclerViewExpenses.layoutManager = LinearLayoutManager(context)
        binding.recyclerViewExpenses.adapter = adapter
    }
}