// Transcribed from the business menu and package details supplied by the owner.
// Confirmed October 15, 2026: 100–1,000 guests; elegant chairs +PHP 10/head.
export const rodelsFoods: Record<string, string[]> = {
  Chicken: ['Chicken Cordon Bleu', 'Baked Chicken Pastel', 'Chicken BBQ', 'Chicken Wrapped in Bacon', 'Chicken Curry', 'Chicken Teriyaki', 'Garlic Buttered Chicken', 'Pineapple Chicken', 'Chicken Fillet', 'Chicken a la King', 'Fried Chicken'],
  Beef: ['Lengua', 'Beef with Broccoli', 'Roast Beef with Buttered Vegetables', 'Beef with Mushroom', 'Beef Caldereta', 'Beef Steak', 'Beef Teriyaki', 'Korean Beef', 'Beef Morcon', 'Beef Salpicao', 'Beef Mechado', 'Pepper Beef Steak', 'Beef Kare-Kare'],
  'Pasta / Noodles': ['Beefy Spaghetti', 'Creamy Carbonara', 'Baked Macaroni', 'Beefy Lasagna', 'Seafood Pasta', 'Chicken Alfredo', 'Sotanghon Guisado', 'Bihon Guisado', 'Sotanghon / Canton Guisado', 'Canton Guisado', 'Japchae', 'Palabok'],
  Pork: ['Pork Morcon', 'Korean Sweet Chili Pork', 'Pork Mongolian', 'Pork Hamonado', 'Sweet and Sour Pork', 'Pork Menudo', 'Pork Asado', 'Pork Teriyaki', 'Pork BBQ', 'Garlic Pork in Oyster Sauce', 'Pork Caldereta', 'Lechon Kawali', 'Pork Pinatisan', 'Pork Sisig', 'Pork Dinakdakan', 'Tokwa’t Baboy'],
  Seafood: ['Shrimp Tempura', 'Garlic Buttered Shrimp', 'Sweet Chili Shrimp', 'Shrimp Gambas', 'Grilled Prawns', 'Seafood Teriyaki', 'Seafood Salpicao', 'Seafood Boil (Spicy Garlic / Cajun)', 'Fish and Tofu in Black Bean Sauce', 'Fish Fillet with Sweet and Sour Sauce', 'Fish Fillet', 'Grilled Blue Marlin', 'Grilled Tuna', 'Squid with Vegetables', 'Seafood Kare-Kare'],
  Vegetables: ['Kare-Kare (Beef / Pork / Seafood)', 'Green Peas with Quail Eggs', 'Seafood Vegetables with Tofu', 'Chopsuey', 'Gising-Gising', 'Stir Fry Vegetables', 'Buttered Vegetables', 'Mixed Vegetables', 'Creamy Mixed Vegetables', 'Ampalaya con Carne', 'Pinakbet'],
}
export const rodelsDrinks = ['4 Seasons', 'Pineapple Punch', 'Cucumber Lemonade', 'Iced Tea', 'Red Tea', 'Black Gulaman', 'Softdrinks']
export const rodelsDesserts = ['Fruit Salad', 'Buko Pandan', 'Buko Lychee', 'Buko Melon', 'Coffee Jelly']
export const rodelsInclusions = ['Rice', '1 drink and 1 dessert', 'Basic tables and chairs', 'Simple buffet setup with flower vase or balloon centerpiece']
export const suggestedMenus = [
  [['Seafood Vegetables with Tofu'], ['Korean Beef'], ['Fried Chicken']],
  [['Squid with Vegetables'], ['Lengua'], ['Pork Hamonado'], ['Chicken BBQ', 'Chicken Fillet']],
  [['Green Peas with Quail Eggs', 'Mixed Vegetables'], ['Beef with Broccoli'], ['Baked Chicken Pastel'], ['Pork Morcon'], ['Fish Fillet']],
  [['Seafood Kare-Kare', 'Beef Kare-Kare'], ['Roast Beef with Buttered Vegetables'], ['Grilled Blue Marlin'], ['Pork Menudo'], ['Chicken Cordon Bleu'], ['Shrimp Tempura']],
]
export const rodelsMenus = [32000, 35000, 38000, 42000].map((price, index) => ({
  name: `Set Menu No. ${index + 1}`, price, dish_count: index + 3,
  min_guests: 100, max_guests: 1000, pricing_version: 2,
  description: `Pick your own ${index + 3} dishes from our catering menu.`,
  inclusions: rodelsInclusions, suggested_dishes: suggestedMenus[index],
}))
// These fixed event fees are additional to the menu price, not per guest.
export const rodelsSetups = [
  { name: 'Simple buffet setup', price: 0, description: 'Included: simple buffet setup with flower vase or balloon centerpiece.' },
  { name: 'Birthday setup', price: 1500000, description: 'Additional event setup: stage backdrop, elegant chair and entrance.' },
  { name: 'Wedding setup', price: 3000000, description: 'Additional event setup: stage backdrop, elegant chair, entrance, presidential table, buffet setup and diamond dance floor.' },
]
export const rodelsChairs = [{ name: 'Monoblock', price: 0 }, { name: 'Elegant chair', price: 1000 }]
export const rodelsTables = [{ name: 'Round table', price: 0 }, { name: 'Long table', price: 0 }]
