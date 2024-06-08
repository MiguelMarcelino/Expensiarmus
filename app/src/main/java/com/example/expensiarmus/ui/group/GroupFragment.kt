package com.example.expensiarmus.ui.group

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.expensiarmus.R
import com.example.expensiarmus.data.GroupItem
import com.example.expensiarmus.databinding.FragmentGroupBinding

class GroupFragment : Fragment() {

    private var _binding: FragmentGroupBinding? = null

    // This property is only valid between onCreateView and
    // onDestroyView.
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGroupBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val listView: ListView = binding.listView

        // TODO: Replace with your data. Make call to Firebase
        val items = listOf(
            GroupItem(1, "Item 1", "Description 1"),
            GroupItem(2, "Item 2", "Description 2"),
            GroupItem(3, "Item 3", "Description 3")
        )
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, items.map { it.name })
        listView.adapter = adapter

        listView.onItemClickListener = AdapterView.OnItemClickListener { _, _, position, _ ->
            val selectedItem = items[position]
            val bundle = Bundle().apply {
                putInt("id", selectedItem.id.toInt())
                putString("name", selectedItem.name)
                putString("description", selectedItem.description)
            }
            findNavController().navigate(R.id.action_groupFragment_to_groupDetailFragment, bundle)
        }

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}