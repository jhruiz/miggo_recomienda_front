/**
 * Servicio del catálogo de ubicaciones (tarea 19.5, Requisitos 15.4, 15.5, 15.6).
 *
 * Envuelve las llamadas Axios a los endpoints públicos del catálogo geográfico
 * (países, departamentos y ciudades), reutilizando el cliente HTTP base
 * (`src/services/http.ts`). El catálogo es de solo lectura y cascada: los
 * departamentos dependen de un país y las ciudades de un departamento.
 *
 * Endpoints consumidos (todos públicos):
 *  - `GET /countries`                         → `{ data: { countries } }`
 *  - `GET /departments?country_id={id}`       → `{ data: { departments } }`
 *  - `GET /cities?department_id={id}`         → `{ data: { cities } }`
 *
 * Todas las respuestas siguen el envelope `{ data, message, errors?, meta? }`.
 */
import http from './http'
import type { ApiEnvelope } from './http'

/** País tal como lo expone la API. */
export interface Country {
  id: number
  name: string
  iso_code: string | null
}

/** Departamento (provincia/estado) asociado a un país. */
export interface Department {
  id: number
  country_id: number
  name: string
}

/** Ciudad asociada a un departamento. */
export interface City {
  id: number
  department_id: number
  name: string
}

export const locationsService = {
  /**
   * Obtiene el catálogo completo de países (sin paginar).
   * Responde `{ data: { countries } }`.
   */
  countries(): Promise<Country[]> {
    return http
      .get<ApiEnvelope<{ countries: Country[] }>>('/countries')
      .then(res => res.data.data.countries ?? [])
  },

  /**
   * Obtiene los departamentos de un país concreto.
   * Responde `{ data: { departments } }`.
   */
  departments(countryId: number): Promise<Department[]> {
    return http
      .get<ApiEnvelope<{ departments: Department[] }>>('/departments', {
        params: { country_id: countryId },
      })
      .then(res => res.data.data.departments ?? [])
  },

  /**
   * Obtiene las ciudades de un departamento concreto.
   * Responde `{ data: { cities } }`.
   */
  cities(departmentId: number): Promise<City[]> {
    return http
      .get<ApiEnvelope<{ cities: City[] }>>('/cities', {
        params: { department_id: departmentId },
      })
      .then(res => res.data.data.cities ?? [])
  },
}

export default locationsService
