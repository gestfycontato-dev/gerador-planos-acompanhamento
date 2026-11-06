export const doctorInitials = (name: string) => name.trim() ? name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : 'DR'
export const clinicInitials = (name: string) => name.trim() ? name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : 'CL'
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
