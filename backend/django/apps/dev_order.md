Develop serializers in this order

1. ~Map~
2. ~Navigation~
3. ~Search~
4. ~Annotation~
5. ~Authentication~
6. ~Sessions~
7. ~Hardware~
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