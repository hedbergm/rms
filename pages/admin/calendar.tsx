export default function RemovedCalendar(){
  if (typeof window !== 'undefined') {
    window.location.replace('/');
  }
  return null;
}
