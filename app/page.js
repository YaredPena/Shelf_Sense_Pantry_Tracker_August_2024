'use client';

import { useState, useEffect } from 'react';
import db from '@/firebase'; 
import { collection, doc, getDocs, setDoc, deleteDoc, getDoc, } from 'firebase/firestore';
import { getCompletion } from '../openai'; 

export default function Home() {
  const [inventory, setInventory] = useState([]); 
  const [itemName, setItemName] = useState('');   
  const [searchQuery, setSearchQuery] = useState(''); 
  const [open, setOpen] = useState(false);        
  const [animate, setAnimate] = useState({});     
  const [userQuery, setUserQuery] = useState(''); 
  const [aiResponse, setAiResponse] = useState(''); 
  const [loading, setLoading] = useState(false); 

  // Inventory fetching function
  const updateInventory = async () => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const querySnapshot = await getDocs(inventoryRef);
      const inventoryList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        inventoryList.push({
          name: doc.id,
          quantity: data.quantity || 0, 
          isImported: data.isImported || false 
        });
      });
      setInventory(inventoryList);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };


  // Add Item function
  const addItem = async (item) => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const docRef = doc(inventoryRef, item);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const { quantity, isImported } = docSnap.data();

        // Update quantity if not an imported item
        if (!isImported) {
          await setDoc(docRef, { quantity: quantity + 1 });
        }
      } else {
        // Add new item with default quantity
        await setDoc(docRef, { quantity: 1, isImported: false });
      }

      // Update local state
      await updateInventory();

      // Trigger pop-up animation for newly added items
      setAnimate((prev) => ({ ...prev, [item]: 'animate-pop-up' }));
      setTimeout(() => setAnimate((prev) => ({ ...prev, [item]: '' })), 500); 
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  // Remove Item function
  const removeItem = async (item) => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const docRef = doc(inventoryRef, item);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const { quantity, isImported } = docSnap.data();

        if (quantity === 1) {
          // Immediately remove the item from state
          setInventory((prev) => prev.filter(({ name }) => name !== item));

          // Apply the pop-away animation
          setAnimate((prev) => ({ ...prev, [item]: 'animate-pop-away' }));

          // Wait for the animation to complete before deleting
          setTimeout(async () => {
            // Only delete the item from the database, not the recipe
            await deleteDoc(docRef);
            await updateInventory();

            setAnimate((prev) => {
              // Remove the animation class to ensure the card is hidden
              const updatedState = { ...prev };
              delete updatedState[item];
              return updatedState;
            });
          }, 500); // this must match animation
        } else {
          await setDoc(docRef, { quantity: quantity - 1 });
          await updateInventory();
        }
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  // Increase Item Quantity function
  const increaseItemQuantity = async (item) => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const docRef = doc(inventoryRef, item);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const { quantity } = docSnap.data();
        await setDoc(docRef, { quantity: quantity + 1 });
      }
      await updateInventory();
    } catch (error) {
      console.error('Error increasing item quantity:', error);
    }
  };

  // Remove All Items function
  const removeAllItems = async () => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const querySnapshot = await getDocs(inventoryRef);

      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      await updateInventory(); // Refresh the inventory list
    } catch (error) {
      console.error('Error removing all items:', error);
    }
  };

  // Handle OpenAI Prompt
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const prompt = `Provide a recipe with quantities of ingredients for: ${userQuery}`;
      
      const result = await getCompletion(prompt);
      setAiResponse(result);
    } catch (error) {
      console.error('Error generating response:', error);
      setAiResponse('Error generating AI response.');
    } finally {
      setLoading(false);
    }
  };

// Import Recipe function
const importRecipe = async () => {
  try {
    if (!aiResponse) {
      console.error('No recipe available to import.');
      return;
    }

    // Extract ingredients from aiResponse
    const ingredientLines = aiResponse.split('\n').filter(line => line.startsWith('-') || line.toLowerCase().includes('ingredients'));

    // Extract only the ingredients after the "Ingredients" section
    const ingredients = [];
    let isInIngredientsSection = false;

    for (const line of ingredientLines) {
      if (line.toLowerCase().includes('ingredients')) {
        isInIngredientsSection = true;
        continue; // Skip the "Ingredients" header line
      }
      if (isInIngredientsSection && line.trim() === '') {
        isInIngredientsSection = false;
        break; // Stop if we encounter an empty line after the ingredients
      }
      if (isInIngredientsSection && (line.startsWith('-') || line.trim() !== '')) {
        ingredients.push(line.replace(/^-/, '').trim());
      }
    }

    if (ingredients.length === 0) {
      console.error('No ingredients found in the recipe.');
      return;
    }

    // Add ingredients to the inventory with imported flag
    for (const ingredient of ingredients) {
      await addImportedIngredient(ingredient);
    }

    console.log('Ingredients imported successfully.');

  } catch (error) {
    console.error('Error importing recipe:', error);
  }
};

// Function to add imported ingredient
const addImportedIngredient = async (item) => {
  try {
    const inventoryRef = collection(db, 'inventory');
    const docRef = doc(inventoryRef, item);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Add the ingredient with an imported flag
      await setDoc(docRef, { quantity: 1, isImported: true });
    } else {
      // If it exists, update the quantity
      const data = docSnap.data();
      if (!data.isImported) {
        await setDoc(docRef, { quantity: data.quantity + 1, isImported: true });
      }
    }

    // Update local state
    setInventory(prev => [...prev, { name: item, isImported: true }]);

    // Trigger pop-up animation for newly added imported items
    setAnimate(prev => ({ ...prev, [item]: 'animate-pop-up' }));
    setTimeout(() => setAnimate(prev => ({ ...prev, [item]: '' })), 500); // Ensure this matches the animation duration
  } catch (error) {
    console.error('Error adding imported ingredient:', error);
  }
};

  // Modal toggle functions
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Filtered inventory based on search query
  const filteredInventory = inventory.filter(({ name }) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row items-start justify-start min-h-screen bg-gray-100 p-4 transition-all duration-300">
      {/* Left Side Sections */}
      <div className="flex-1 md:w-2/3 mb-4">
        {/* Modal */}
        {open && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-500 bg-opacity-75 z-50 transition-opacity duration-300">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative z-50 transform scale-100 transition-transform duration-300">
              <h2 className="text-xl font-bold mb-4 text-black">Add Item</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg p-2 flex-1 text-black transition-colors duration-300"
                  placeholder="Item name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-300"
                  onClick={() => {
                    addItem(itemName);
                    setItemName('');
                    handleClose();
                  }}
                >
                  Add
                </button>
              </div>
              <button
                className="mt-4 bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-300"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
        <h1 className="text-4xl font-bold text-left text-black">Shelf Sense</h1>

        <button
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-300 mr-4 mb-3"
          onClick={handleOpen}
        >
          Add New Item
        </button>

        <button
          className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors duration-300 mb-3"
          onClick={removeAllItems}
        >
          Remove All
        </button>

        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-blue-200 text-black p-4 relative">
            <div className="text-left font-bold text-lg">Pantry Items</div>
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 text-black absolute top-4 right-4 w-48 transition-colors duration-300"
              placeholder="Search items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="p-4 space-y-2 overflow-auto max-h-80">
              {filteredInventory.map(({ name, quantity, isImported }) => (
                <div
                  key={name}
                  className={`flex items-center justify-between p-2 border border-gray-300 rounded-lg ${animate[name] || ''}`}
                >
                  <div className="text-black flex-1">
                    <span className="font-bold">
                      {isImported ? name.replace(/^\d+\s/, '') : name} {/* Remove quantity for imported items */}
                    </span>
                    {!isImported && <span className="ml-2 text-gray-600">({quantity})</span>}
                  </div>
                  {!isImported && (
                    <div>
                      <button
                        className="bg-green-500 text-white px-1 py-0.5 rounded-lg hover:bg-green-600 transition-colors duration-300 mr-2"
                        onClick={() => increaseItemQuantity(name)}
                      >
                        +
                      </button>
                      <button
                        className="bg-red-500 text-white px-1 py-0.5 rounded-lg hover:bg-red-600 transition-colors duration-300"
                        onClick={() => removeItem(name)}
                      >
                        -
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>          
          </div>       
        </div>

      {/* Right Side Sections */}
      <div className="flex-1 md:w-1/3">
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-green-200 text-black p-4">
            <h2 className="text-lg font-bold text-center">Ask for a Recipe</h2>
          </div>
          <div className="p-4">
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 text-black w-full transition-colors duration-300"
              placeholder="Enter ingredients or dish name"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <button
              className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors duration-300 mt-2"
              onClick={handleGenerate}
            >
              Generate Recipe
            </button>
            {loading && <div className="mt-2 text-center text-black">Loading...</div>}
          </div>
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden mt-4">
          <div className="bg-green-200 text-black p-4">
            <h2 className="text-lg font-bold text-center">Generated Recipe</h2>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto bg-white text-black">
            {aiResponse ? (
              <ul className="list-disc pl-5">
                {aiResponse
                  .split('\n')
                  .filter(line => line.trim() !== '' && !line.toLowerCase().includes('enjoy your'))
                  .map((line, index) => {
                    if (
                      line.toLowerCase().includes('ingredients') ||
                      line.toLowerCase().includes('instructions')
                    ) {
                      return (
                        <li key={index} className="list-none font-bold">
                          {line}
                        </li>
                      );
                    } else {
                      return (
                        <li key={index} className="mb-1">
                          {line}
                        </li>
                      );
                    }
                  })}
                <button
                  className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors duration-300 mt-2"
                  onClick={importRecipe}
                >
                  Import Recipe
                </button>
              </ul>
            ) : (
              <p>No recipe generated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}