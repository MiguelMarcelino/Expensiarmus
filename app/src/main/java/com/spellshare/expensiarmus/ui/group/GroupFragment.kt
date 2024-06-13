package com.spellshare.expensiarmus.ui.group

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.databinding.FragmentGroupBinding
import com.spellshare.expensiarmus.dbconnector.GroupConnector

class GroupFragment : Fragment() {

    private var _binding: FragmentGroupBinding? = null

    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGroupBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val listView: ListView = binding.listView

        val groupConnector = GroupConnector()
        val groupItems = groupConnector.getItems()
        val adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_list_item_1,
            groupItems.map { it.name })
        listView.adapter = adapter

        listView.onItemClickListener = AdapterView.OnItemClickListener { _, _, position, _ ->
            val selectedItem = groupItems[position]
            val bundle = Bundle().apply {
                putString("uid", selectedItem.uid)
                putString("name", selectedItem.name)
                putString("description", selectedItem.description)
                putString("ownerUid", selectedItem.ownerUid)
            }
            findNavController().navigate(R.id.action_nav_group_to_nav_group_detail, bundle)
        }

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

}