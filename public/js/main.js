document.addEventListener('DOMContentLoaded',()=>{
  const fulfillment=document.querySelector('#fulfillment');
  const deliveryFields=document.querySelectorAll('.delivery-field');
  const toggleDelivery=()=>deliveryFields.forEach(el=>el.style.display=fulfillment?.value==='pickup'?'none':'flex');
  if(fulfillment){fulfillment.addEventListener('change',toggleDelivery);toggleDelivery();}

  const nav=document.querySelector('.shop-nav');
  const onScroll=()=>nav?.classList.toggle('scrolled',window.scrollY>20);
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}
  }),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

  document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',()=>{
    const button=form.querySelector('button[type="submit"],button:not([type])');
    if(button && !button.disabled){button.classList.add('is-loading');}
  }));

  setTimeout(()=>document.querySelectorAll('.alert').forEach(a=>window.bootstrap?.Alert.getOrCreateInstance(a).close()),5000);
});
