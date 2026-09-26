"""Geohash cell helpers and precise distance calculations."""

from __future__ import annotations

import math

import pygeohash

EARTH_RADIUS_M = 6_371_008.8


def encode_geohash(latitude: float, longitude: float, precision: int = 6) -> str:
    """Encode a latitude/longitude pair at the requested geohash precision."""
    if not -90 <= latitude <= 90:
        raise ValueError("latitude must be between -90 and 90 degrees")
    if not -180 <= longitude <= 180:
        raise ValueError("longitude must be between -180 and 180 degrees")
    if not 1 <= precision <= 12:
        raise ValueError("precision must be between 1 and 12")
    return pygeohash.encode(latitude, longitude, precision=precision)


def neighbor_cells(geohash: str) -> frozenset[str]:
    """Return the eight geohash cells immediately surrounding ``geohash``."""
    if not geohash:
        raise ValueError("geohash cannot be empty")

    latitude, longitude, lat_error, lon_error = pygeohash.decode_exactly(geohash)
    lat_step = lat_error * 2
    lon_step = lon_error * 2
    precision = len(geohash)
    neighbors: set[str] = set()

    for lat_offset in (-lat_step, 0.0, lat_step):
        neighbor_lat = latitude + lat_offset
        if not -90 <= neighbor_lat <= 90:
            continue
        for lon_offset in (-lon_step, 0.0, lon_step):
            if lat_offset == 0.0 and lon_offset == 0.0:
                continue
            neighbor_lon = (longitude + lon_offset + 180) % 360 - 180
            neighbors.add(pygeohash.encode(neighbor_lat, neighbor_lon, precision=precision))

    return frozenset(neighbors)


def query_cells(latitude: float, longitude: float, precision: int = 6) -> tuple[str, ...]:
    """Return the center geohash and its neighbors as a sorted 3×3 query grid."""
    center = encode_geohash(latitude, longitude, precision)
    return tuple(sorted({center, *neighbor_cells(center)}))


def haversine_m(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """Calculate the great-circle distance between two points in meters."""
    for latitude in (latitude_a, latitude_b):
        if not -90 <= latitude <= 90:
            raise ValueError("latitude must be between -90 and 90 degrees")
    for longitude in (longitude_a, longitude_b):
        if not -180 <= longitude <= 180:
            raise ValueError("longitude must be between -180 and 180 degrees")

    lat_a, lat_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = lat_b - lat_a
    delta_lon = math.radians(longitude_b - longitude_a)
    hav = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, hav)))
