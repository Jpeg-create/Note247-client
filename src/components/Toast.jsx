import styles from './Toast.module.css'
export default function Toast({ msg, type = 'info' }) {
  return <div className={styles.toast + ' ' + styles[type]}>{msg}</div>
}
