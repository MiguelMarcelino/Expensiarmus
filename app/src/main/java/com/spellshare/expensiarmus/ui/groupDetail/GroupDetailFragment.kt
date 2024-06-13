package com.spellshare.expensiarmus.ui.groupDetail

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.firebase.firestore.FirebaseFirestore
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.databinding.FragmentGroupDetailBinding
import com.spellshare.expensiarmus.ui.expenseCreation.ExpenseAdapter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class GroupDetailFragment : Fragment() {

    private var _binding: FragmentGroupDetailBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentGroupDetailBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val uid = arguments?.getString("uid")
        val name = arguments?.getString("name")
        val description = arguments?.getString("description")
        val ownerUid = arguments?.getString("ownerUid")

        // binding.textId.text = uid
        binding.textName.text = name
        binding.textDescription.text = description
        // You can set the group image using Glide, Picasso, or any other image loading library
        // Example: Glide.with(this).load(groupImageUrl).into(binding.groupImage)

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
            fetchGroupExpenses(groupId)
        }

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun fetchGroupExpenses(groupId: String) {
        val db = FirebaseFirestore.getInstance()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val querySnapshot = db.collection("expenses")
                    .whereEqualTo("groupUid", groupId)
                    .get()
                    .await()

                val expenses =
                    querySnapshot.documents.mapNotNull { it.toObject(Expense::class.java) }

                withContext(Dispatchers.Main) {
                    displayExpenses(expenses)
                }
            } catch (e: Exception) {
                e.printStackTrace() // Handle the error
            }
        }
    }

    private fun displayExpenses(expenses: List<Expense>) {
        val adapter = ExpenseAdapter(expenses)
        binding.recyclerViewExpenses.layoutManager = LinearLayoutManager(context)
        binding.recyclerViewExpenses.adapter = adapter
    }
}

