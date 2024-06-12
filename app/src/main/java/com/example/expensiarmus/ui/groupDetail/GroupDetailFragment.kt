package com.example.expensiarmus.ui.groupDetail

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.expensiarmus.R
import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.identifiers.GroupIdentifier
import com.example.expensiarmus.databinding.FragmentGroupDetailBinding
import com.example.expensiarmus.dbconnector.GroupExpenseConnector


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

        binding.textId.text = id.toString()
        binding.textName.text = name
        binding.textDescription.text = description

        binding.fab.setOnClickListener {
            findNavController().navigate(R.id.action_nav_group_detail_to_nav_expense_detail)
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