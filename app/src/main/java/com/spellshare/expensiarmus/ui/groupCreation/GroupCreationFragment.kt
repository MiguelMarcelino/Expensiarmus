package com.spellshare.expensiarmus.ui.groupCreation

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Group
import com.spellshare.expensiarmus.databinding.FragmentCreateGroupBinding
import com.spellshare.expensiarmus.dbconnector.GroupConnector

class CreateGroupFragment : Fragment() {

    private var _binding: FragmentCreateGroupBinding? = null
    private val binding get() = _binding!!

    private lateinit var editTextGroupName: EditText
    private lateinit var editTextGroupDescription: EditText
    private lateinit var buttonCreateGroup: Button

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentCreateGroupBinding.inflate(inflater, container, false)
        val root: View = binding.root

        editTextGroupName = root.findViewById(R.id.editTextGroupName)
        editTextGroupDescription = root.findViewById(R.id.editTextGroupDescription)
        buttonCreateGroup = root.findViewById(R.id.buttonCreateGroup)

        buttonCreateGroup.setOnClickListener {
            val groupName = editTextGroupName.text.toString().trim()
            val groupDescription = editTextGroupDescription.text.toString().trim()
            val ownerUid = "user-uid" // TODO: Replace with the actual owner's UID

            if (groupName.isEmpty()) {
                editTextGroupName.error = "Group name is required"
                editTextGroupName.requestFocus()
                return@setOnClickListener
            }

            createGroup(groupName, groupDescription, ownerUid)
        }

        // Inflate the layout for this fragment
        return root
    }

    private fun createGroup(name: String, description: String?, ownerUid: String) {
        // Implement your group creation logic here
        // For example, save the group to a database
        val groupConnector = GroupConnector()
        val group = Group(name, description, ownerUid)

        try {
            groupConnector.addItem(group)
        } catch (e: Exception) {
            // Handle the exception
            Toast.makeText(requireContext(), "Failed to create group", Toast.LENGTH_SHORT).show()
            return
        }

        // After successful creation, navigate back or show a success message
        Toast.makeText(requireContext(), "Group created successfully", Toast.LENGTH_SHORT).show()
        findNavController().navigateUp()
    }
}
