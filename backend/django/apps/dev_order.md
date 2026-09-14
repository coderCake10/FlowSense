Develop serializers in this order

1. ~Map~ (RETURN LATER)
2. ~Navigation~ (RETURN LATER)
3. ~Search~ (RETURN LATER)
4. ~Annotation~ (RETURN LATER)
5. ~Authentication~ (RETURN LATER)
6. Sessions (UD)
7. Hardware (UD)
8. Analytics
9. Assets

# Maps

## API Endpoints

### View/s

GET map/context/

### ViewSet/s

GET map/areas
POST map/areas
GET map/areas/{id}
PATCH map/areas/{id}
DELETE map/areas/{id}
GET map/areas/{id}/floors
GET map/floors/{id}
GET map/rooms
GET map/rooms/{id}
GET map/entrances
GET map/stairs
GET map/elevators
GET map/outdoor-walkways
GET map/personnel
GET map/rooms/{id}/personnel