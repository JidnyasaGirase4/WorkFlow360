import { useState } from 'react'

// Small form-state helper: values, per-field errors, blur + change validation.
// `validate(values)` must return an object of { field: message } for invalid fields.
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  function setValue(field, value) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (Object.keys(errors).length > 0) {
      // Clear errors as soon as they are fixed (and keep dependent fields, e.g. confirm password, in sync).
      const all = validate(next)
      setErrors((prev) => {
        const kept = {}
        Object.keys(prev).forEach((key) => {
          if (all[key]) kept[key] = all[key]
        })
        return kept
      })
    }
  }

  // Set several values at once (e.g. demo-account quick fill) and clear all errors.
  function setMany(partial) {
    setValues((v) => ({ ...v, ...partial }))
    setErrors({})
  }

  function handleBlur(field) {
    const all = validate(values)
    setErrors((prev) => {
      const next = { ...prev }
      if (all[field]) next[field] = all[field]
      else delete next[field]
      return next
    })
  }

  // Props to spread on <Input>/<Textarea>/<Select>
  function bind(field) {
    return {
      name: field,
      value: values[field],
      error: errors[field],
      onChange: (e) => setValue(field, e.target.value),
      onBlur: () => handleBlur(field),
    }
  }

  function submit() {
    const all = validate(values)
    setErrors(all)
    const invalid = Object.keys(all)
    // Move focus to the first invalid field so keyboard / screen-reader users land on the problem.
    if (invalid.length > 0) document.getElementsByName(invalid[0])[0]?.focus()
    return invalid.length === 0
  }

  function reset() {
    setValues(initialValues)
    setErrors({})
  }

  return { values, errors, setValue, setMany, setErrors, bind, submit, reset }
}
