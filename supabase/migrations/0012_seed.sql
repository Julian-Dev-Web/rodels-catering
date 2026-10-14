-- Illustrative catalog only. No invented customer or financial history.
insert into public.menu_sets(id,name,description,price,dish_count,min_guests) values
('10000000-0000-0000-0000-000000000001','Classic Gathering','Comforting favorites for intimate celebrations.',35000,3,30),
('10000000-0000-0000-0000-000000000002','Signature Celebration','A generous spread for your most meaningful moments.',55000,5,50),
('10000000-0000-0000-0000-000000000003','Grand Occasion','An abundant feast, beautifully presented.',75000,7,80);
insert into public.menu_categories(id,name) values('20000000-0000-0000-0000-000000000001','Filipino favorites'),('20000000-0000-0000-0000-000000000002','Vegetables & sides');
insert into public.dishes(name,category_id) select name,'20000000-0000-0000-0000-000000000001'::uuid from unnest(array['Beef caldereta','Chicken pastel','Pork barbecue','Fish fillet with tartar sauce','Creamy carbonara','Pancit canton','Chicken teriyaki','Beef with mushrooms']) name;
insert into public.dishes(name,category_id) values('Buttered mixed vegetables','20000000-0000-0000-0000-000000000002');
insert into public.drinks(name) values('House iced tea'),('Calamansi cooler'),('Pineapple juice');
insert into public.desserts(name) values('Leche flan'),('Buko pandan'),('Fruit salad');
insert into public.event_setups(name,price) values('Classic ivory',300000),('Garden romance',600000),('Burgundy elegance',800000);
insert into public.event_features(name,price) values('Floral centerpiece upgrade',150000),('Welcome backdrop',300000),('Ambient lighting',200000);
insert into public.add_ons(name,price) values('Dessert station',500000),('Coffee & tea station',350000),('Extra service hour',150000);
insert into public.chair_types(name,price) values('Monoblock',2000),('Tiffany',10000);
insert into public.table_types(name,price) values('Round banquet table',0),('Long banquet table',0);
insert into public.gallery_images(name,image_url) values('Floral celebration setup','/images/celebration.jpg'),('A wedding to remember','/images/table.jpg'),('Corporate celebrations','/images/food.jpg');
