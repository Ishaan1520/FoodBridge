import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
  Leaf, HeartHandshake, MapPin, Utensils, Users, ArrowRight, Menu, X, LogIn, LogOut,
  LayoutDashboard, PackagePlus, ClipboardList, History, Bell, Settings, Search,
  CheckCircle2, Clock3, Truck, Navigation, Camera, Plus, ChevronRight, ShieldCheck,
  HandHeart, Building2, Bike, MapPinned, CircleCheck, AlertCircle, RefreshCw,
  ChartNoAxesCombined, Sprout, Globe2, Mail, Phone, Instagram, Facebook, Filter
} from 'lucide-react';
import { getData, subscribe, refreshData, addDonation, createRequest, updateRequest, assignVolunteer, updateAssignment, getCurrentPosition } from './lib/store';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { getCurrentUser, signIn, signUp, signOutFromSupabase } from './lib/auth';

const moneyless = n => new Intl.NumberFormat('en-IN').format(n || 0);
const timeAgo = t => {
  const m = Math.max(1, Math.floor((Date.now()-t)/60000));
  return m < 60 ? `${m} min ago` : `${Math.floor(m/60)} hr ago`;
};
const roleNames = { donor:'Food donor', ngo:'NGO partner', volunteer:'Volunteer', admin:'Administrator' };

function App() {
  const [user,setUser] = useState(null);
  const [authReady,setAuthReady] = useState(false);
  const [data,setData] = useState(getData());
  const [toast,setToast] = useState('');
  const [mobileOpen,setMobileOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => subscribe(setData), []);

  
useEffect(() => {
  let active = true;

  const syncUser = async session => {
    if (!session?.user) {
      if (active) {
        setUser(null);
        await refreshData().catch(error =>
          console.error('FoodBridge data refresh failed:', error)
        );
      }
      return;
    }

    try {
      const current = await getCurrentUser(session);

      if (active) {
        setUser(current);

        await refreshData().catch(error =>
          console.error('FoodBridge data refresh failed:', error)
        );
      }
    } catch (error) {
      console.error('FoodBridge session restore failed:', error);
      if (active) setUser(null);
    }
  };

  if (!isSupabaseConfigured) {
    setAuthReady(true);
    return () => {
      active = false;
    };
  }

  supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    if (error) {
      console.error('Could not restore Supabase session:', error);
    }

    await syncUser(session);

    if (active) setAuthReady(true);
  });

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_event, session) => {
      Promise.resolve().then(() => syncUser(session));

      if (active) setAuthReady(true);
    });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}, []);


  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const signOut = async () => {
    try {
      await signOutFromSupabase();
      setUser(null);
      nav('/');
      setToast('You have been signed out.');
    } catch (error) {
      setToast(error.message || 'Could not sign out. Please try again.');
    }
  };

  const onLogin = u => {
    setUser(u);
    nav('/app');
    setToast(`Welcome back, ${u.name.split(' ')[0]}!`);
  };

  return <>
    <Routes>
      <Route path="/" element={<Landing user={user} onLogout={signOut} />} />
      <Route path="/about" element={<InfoPage type="about" />} />
      <Route path="/how-it-works" element={<InfoPage type="how" />} />
      <Route path="/explore" element={<Explore data={data} />} />
      <Route path="/contact" element={<InfoPage type="contact" />} />
      <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
      <Route path="/app" element={!authReady ? <div className="auth-loading">Checking your FoodBridge session…</div> : user ? <Dashboard user={user} data={data} toast={setToast} onLogout={signOut} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </>;
}
function Header({ user, onLogout }) {
  const [open,setOpen] = useState(false);
  const loc = useLocation();
  const links = [['About','/about'],['How it works','/how-it-works'],['Explore food','/explore'],['Contact','/contact']];
  return <header className="site-header">
    <div className="nav-wrap">
      <Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={23}/></span><span>food<span>bridge</span><small>GOOD FOOD. SHARED WELL.</small></span></Link>
      <nav className={open?'nav-links open':'nav-links'}>
        {links.map(([label,path])=><Link key={path} className={loc.pathname===path?'active':''} to={path} onClick={()=>setOpen(false)}>{label}</Link>)}
        {user ? <Link className="nav-cta" to="/app">Open dashboard <ArrowRight size={16}/></Link> : <Link className="nav-cta" to="/login">Get started <ArrowRight size={16}/></Link>}
        {user && <button className="nav-logout" onClick={onLogout}>Sign out</button>}
      </nav>
      <button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle menu">{open?<X/>:<Menu/>}</button>
    </div>
  </header>;
}

function Landing({ user, onLogout }) {
  const data = getData();
  const meals = data.donations.reduce((n,d)=>n+(d.servings||0),0);
  return <div className="public-page">
    <Header user={user} onLogout={onLogout}/>
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> A little kindness goes a long way</div>
          <h1>Good food deserves<br/><em>a good destination.</em></h1>
          <p className="hero-lead">We bring food donors, community organisations and volunteers together to make sure surplus food reaches the people who need it.</p>
          <div className="hero-actions"><Link className="btn btn-primary" to="/login">Join the movement <ArrowRight size={18}/></Link><Link className="btn btn-light" to="/how-it-works">See how it works</Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>🍲</span><span>💚</span><span>🤝</span></div><div><strong>Every meal matters.</strong><small>Be part of a more thoughtful food system.</small></div></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?w=1200" alt="A colourful, freshly prepared meal"/><div className="photo-label"><span className="live-dot"/> Community meals, made possible</div></div>
          <div className="float-card float-top"><span className="float-icon"><Sprout size={20}/></span><div><strong>Less waste</strong><small>More nourishment</small></div></div>
          <div className="float-card float-bottom"><div className="mini-avatars">👩🏽‍🍳 🧑🏻‍🤝‍🧑🏽</div><div><strong>One connected community</strong><small>Donors · NGOs · Volunteers</small></div></div>
          <div className="hero-scribble">share a little<br/>goodness <span>♡</span></div>
        </div>
      </section>
      <section className="trust-strip"><div><strong>{moneyless(meals)}+</strong><span>meal portions listed</span></div><div><strong>{data.donations.length}</strong><span>food donations</span></div><div><strong>3</strong><span>ways to make a difference</span></div><div className="trust-note"><HeartHandshake size={23}/><span>Small acts. Shared impact.</span></div></section>
      <section className="section section-soft"><div className="section-heading"><span className="eyebrow">HOW FOODBRIDGE WORKS</span><h2>Three people. <em>One purpose.</em></h2><p>Everyone has a part to play in getting good food to good places.</p></div>
        <div className="role-cards">
          <RoleCard icon={<Utensils/>} number="01" title="Food donors" desc="Restaurants, cafes, stores and individuals share surplus food before it goes to waste." color="mint"/>
          <RoleCard icon={<Building2/>} number="02" title="NGO partners" desc="Community organisations discover food nearby and request what their communities need." color="peach"/>
          <RoleCard icon={<Bike/>} number="03" title="Volunteers" desc="Local heroes coordinate pickups and help deliver food safely to its destination." color="lavender"/>
        </div>
      </section>
      <section className="impact-section"><div className="impact-art"><img src="https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1000" alt="Volunteers preparing food for a community"/><span className="impact-sticker">Goodness<br/>in motion ✳</span></div><div className="impact-copy"><span className="eyebrow">WHY IT MATTERS</span><h2>Less food wasted.<br/><em>More lives nourished.</em></h2><p>FoodBridge makes food redistribution easier to coordinate, more transparent to track, and more human at every step.</p><div className="impact-points"><div><CheckCircle2/><span><b>Rescue good food</b><small>Share surplus while it's still fresh and safe.</small></span></div><div><CheckCircle2/><span><b>Connect local communities</b><small>Bring nearby donors and organisations together.</small></span></div><div><CheckCircle2/><span><b>Make every handoff count</b><small>Track requests, pickups and deliveries.</small></span></div></div><Link to="/about" className="text-link">Our mission <ArrowRight size={17}/></Link></div></section>
      <section className="cta-band"><div><span className="eyebrow">YOUR NEXT GOOD THING STARTS HERE</span><h2>Have food to share?<br/>Or a hand to lend?</h2><p>There is a place for you in the FoodBridge community.</p></div><Link to="/login" className="btn btn-white">Find your place <ArrowRight size={18}/></Link></section>
    </main>
    <Footer/>
  </div>;
}

function RoleCard({icon,number,title,desc,color}) {
  return <div className="role-card"><div className={`role-icon ${color}`}>{icon}</div><div className="role-number">{number}</div><h3>{title}</h3><p>{desc}</p><span className="card-arrow"><ArrowRight size={18}/></span></div>;
}

function Footer() {
  return <footer className="footer"><div className="footer-main"><Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={23}/></span><span>food<span>bridge</span><small>GOOD FOOD. SHARED WELL.</small></span></Link><p>Connecting surplus food with communities that need it. One thoughtful handoff at a time.</p><div className="socials"><a href="https://instagram.com" aria-label="Instagram"><Instagram/></a><a href="https://facebook.com" aria-label="Facebook"><Facebook/></a><a href="mailto:hello@foodbridge.example" aria-label="Email"><Mail/></a></div></div><div className="footer-bottom"><span>© 2026 FoodBridge. Built for a kinder food system.</span><span>Made with <span className="heart">♥</span> for our communities</span></div></footer>;
}

function InfoPage({type}) {
  const content = {
    about:{eyebrow:'A BETTER WAY TO SHARE',title:<>Food is too good<br/>to go to waste.</>,lead:'FoodBridge is a community-powered platform designed to connect surplus food with people and organisations who can put it to good use.',items:[['Our purpose','Make food redistribution simple, visible and collaborative.'],['Our community','Bring together food donors, NGOs and volunteers in one shared space.'],['Our promise','Help every donation move through a clear, accountable process.']]},
    how:{eyebrow:'SIMPLE STEPS, REAL IMPACT',title:<>From extra food<br/>to shared good.</>,lead:'A clear journey helps everyone know what happens next, from the first listing to the final delivery.',items:[['01 · Donor lists food','Add a description, quantity, collection window and pickup location.'],['02 · NGO requests it','Nearby organisations discover available food and send a request.'],['03 · Donor confirms','The donor reviews the request and confirms the handoff.'],['04 · Volunteer delivers','A volunteer coordinates collection and updates the delivery status.']]},
    contact:{eyebrow:'WE WOULD LOVE TO HEAR FROM YOU',title:<>Good things start<br/>with a conversation.</>,lead:'Have a question, partnership idea or suggestion? Reach out to the FoodBridge team.',items:[['Email','hello@foodbridge.example'],['Phone','+91 90000 00000'],['Location','Lucknow, Uttar Pradesh, India']]}
  }[type];
  return <div className="public-page"><Header/><main className="info-page"><div className="info-hero"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.lead}</p><Link to="/login" className="btn btn-primary">Get involved <ArrowRight size={17}/></Link></div><div className="info-list">{content.items.map(([a,b])=><div className="info-row" key={a}><span>{a}</span><p>{b}</p></div>)}</div></main><Footer/></div>;
}

function Explore({data}) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('All');
  const items=data.donations.filter(d=>d.status==='Available' && (d.food+' '+d.address+' '+d.category).toLowerCase().includes(query.toLowerCase()) && (category==='All'||d.category===category));
  return <div className="public-page"><Header/><main className="explore-page"><div className="page-intro"><span className="eyebrow">FOOD NEAR YOU</span><h1>Good food, ready to <em>find a home.</em></h1><p>Browse available donations and connect with a local food donor.</p></div><div className="explore-tools"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search food, location or category"/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option><option>Cooked meals</option><option>Bakery</option><option>Fruits & vegetables</option><option>Packaged food</option></select></div><div className="explore-grid">{items.map(d=><FoodCard key={d.id} item={d}/>)}</div>{!items.length&&<div className="empty-state"><Utensils/><h3>No matching donations just yet</h3><p>Try another search or check back soon.</p></div>}</main><Footer/></div>;
}

function FoodCard({item}) {
  return <article className="food-card"><div className="food-image"><img src={item.image||'https://images.unsplash.com/photo-1547592180-85f173990554?w=900'} alt={item.food}/><span className="food-tag">{item.category}</span></div><div className="food-card-body"><div className="food-card-top"><h3>{item.food}</h3><span className="fresh-tag"><span/> Available</span></div><p>{item.description}</p><div className="food-meta"><span><Utensils size={15}/>{item.quantity}</span><span><MapPin size={15}/>{item.address}</span><span><Clock3 size={15}/>{item.availableUntil}</span></div><div className="food-card-foot"><b>{item.donor}</b><Link to="/login" className="text-link">Request food <ArrowRight size={15}/></Link></div></div></article>;
}

function LoginPage({onLogin}) {
  const [mode,setMode]=useState('signin');
  const [role,setRole]=useState('donor');
  const [fullName,setFullName]=useState('');
  const [organisation,setOrganisation]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const chooseMode = next => { setMode(next); setError(''); setSuccess(''); };
  const submit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (mode==='signup') {
        if (password.length < 6) throw new Error('Use a password with at least 6 characters.');
        const result = await signUp({ fullName, email, password, role, organisation });
        if (result.needsEmailConfirmation) {
          setSuccess('Your account has been created. Check your email and confirm your address, then return here to sign in.');
        } else {
          onLogin(result.user);
        }
      } else {
        onLogin(await signIn(email,password));
      }
    } catch(err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="login-page"><div className="login-left"><Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={23}/></span><span>food<span>bridge</span><small>GOOD FOOD. SHARED WELL.</small></span></Link><div className="login-art"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?w=1200" alt="A shared meal"/><div className="login-quote">“A shared meal can<br/>bring a community<br/><em>closer together.</em>”</div></div><p className="login-footnote">A little less waste. A little more care. A lot more connection.</p></div><div className="login-right"><Link className="back-home" to="/">← Back to home</Link><div className="login-form-wrap"><span className="eyebrow">WELCOME TO THE TABLE</span><h1>{mode==='signup'?<>Find your place<br/><em>at the table.</em></>:<>Let's make good<br/><em>things happen.</em></>}</h1><p className="muted">{mode==='signup'?'Create your real FoodBridge account.':'Sign in with your FoodBridge account.'}</p><div className="auth-mode-switch"><button type="button" className={mode==='signin'?'active':''} onClick={()=>chooseMode('signin')}>Sign in</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>chooseMode('signup')}>Create account</button></div>{mode==='signup'&&<><span className="field-hint">Choose the portal you want to join.</span><div className="role-select role-select-three">{[['donor',<Utensils/>,'Donor'],['ngo',<Building2/>,'NGO'],['volunteer',<Bike/>,'Volunteer']].map(([r,ic,label])=><button type="button" key={r} onClick={()=>setRole(r)} className={role===r?'selected':''}>{ic}{label}</button>)}</div></>}<form onSubmit={submit} className="login-form">{mode==='signup'&&<><label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" required autoComplete="name"/></label>{role==='ngo'&&<label>Organisation name<input value={organisation} onChange={e=>setOrganisation(e.target.value)} placeholder="Your registered organisation" required/></label>}{role==='donor'&&<label>Business / donor name <span className="field-optional">(optional)</span><input value={organisation} onChange={e=>setOrganisation(e.target.value)} placeholder="Cafe, restaurant or your name"/></label>}</>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label><label>Password<div className="password-wrap"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'At least 6 characters':'Your password'} required autoComplete={mode==='signup'?'new-password':'current-password'}/><button type="button" onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></div></label>{error&&<div className="form-error"><AlertCircle size={16}/>{error}</div>}{success&&<div className="form-success"><CheckCircle2 size={16}/>{success}</div>}<button className="btn btn-primary full-btn" type="submit" disabled={busy||!isSupabaseConfigured}>{busy?(mode==='signup'?'Creating account…':'Signing in…'):(mode==='signup'?'Create my account':'Sign in to FoodBridge')} <ArrowRight size={17}/></button>{!isSupabaseConfigured&&<div className="form-error">Supabase credentials are missing. Check your .env file and restart the development server.</div>}</form><div className="demo-box"><div className="demo-title"><ShieldCheck size={17}/> Real account security</div><p>Your account is stored in Supabase. Your role is assigned during registration and cannot be changed by editing your profile.</p><small>Admin accounts are created separately by the project owner.</small></div><p className="login-disclaimer">If email confirmation is enabled in Supabase, confirm the link sent to your inbox before signing in. Donation and dashboard workflows will be connected to the shared database in the next stages.</p></div></div></div>;
}
function Dashboard({user,data,toast,onLogout}) {
  const [tab,setTab]=useState('overview');
  const [sidebar,setSidebar]=useState(false);
  const [notifications,setNotifications]=useState(false);
  const unread = data.notifications.filter(n=>n.email===user.id&&!n.read).length;

  const navItems = user.role==='donor'
    ? [['overview','Overview',LayoutDashboard],['donations','My donations',Utensils],['requests','Incoming requests',ClipboardList],['history','Donation history',History]]
    : user.role==='ngo'
    ? [['overview','Overview',LayoutDashboard],['discover','Find food',Search],['requests','My requests',ClipboardList],['deliveries','Deliveries',Truck]]
    : user.role==='volunteer'
    ? [['overview','Overview',LayoutDashboard],['tasks','My assignments',Bike],['map','Live location',MapPinned],['history','Delivery history',History]]
    : [['overview','Overview',LayoutDashboard],['users','Community',Users],['donations','All donations',Utensils],['requests','All requests',ClipboardList],['tasks','Assignments',Truck]];

  const changeTab = t => { setTab(t); setSidebar(false); };

  return <div className="dashboard-shell">
    <aside className={sidebar?'sidebar open':'sidebar'}>
      <Link to="/" className="brand dash-brand"><span className="brand-mark"><HeartHandshake size={22}/></span><span>food<span>bridge</span><small>COMMUNITY PLATFORM</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <div className="side-nav">
        {navItems.map(([id,label,Icon])=><button key={id} className={tab===id?'side-link active':'side-link'} onClick={()=>changeTab(id)}><Icon size={18}/>{label}{id==='requests'&&user.role==='donor'&&data.requests.filter(r=>r.donorEmail===user.id&&r.status==='Pending').length>0&&<i/>}</button>)}
      </div>
      <div className="sidebar-bottom">
        <div className="side-help"><div className="help-icon"><HeartHandshake size={19}/></div><b>Every meal matters.</b><p>Thank you for being part of something good.</p></div>
        <button className="side-link" onClick={()=>toast('Profile settings are ready to be connected to your account.')}><Settings size={18}/>Settings</button>
        <button className="side-link signout" onClick={onLogout}><LogOut size={18}/>Sign out</button>
      </div>
    </aside>
    <div className="dash-main">
      <header className="dash-topbar">
        <button className="dash-mobile-menu" onClick={()=>setSidebar(!sidebar)}><Menu/></button>
        <div className="crumb">FoodBridge <ChevronRight size={14}/><b>{navItems.find(n=>n[0]===tab)?.[1]}</b></div>
        <div className="topbar-right">
          <span className="mode-pill"><span/> Live database</span>
          <button className="icon-btn" onClick={()=>setNotifications(!notifications)} aria-label="Notifications"><Bell size={19}/>{unread>0&&<i/>}</button>
          <div className="user-mini"><span className="user-avatar">{user.name.charAt(0)}</span><span><b>{user.name}</b><small>{roleNames[user.role]}</small></span></div>
        </div>
        {notifications&&<div className="notification-pop"><b>Notifications</b><p className="muted">Your recent activity will appear here.</p><span className="tiny-muted">No new notifications</span></div>}
      </header>
      <main className="dash-content">
        <div className="welcome-row">
          <div><span className="eyebrow">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span><h1>{greeting(user.role)}, {user.name.split(' ')[0]} <span>✳</span></h1><p>{welcomeText(user.role)}</p></div>
          <div className="welcome-actions">
            {user.role==='donor'&&<button className="btn btn-primary" onClick={()=>changeTab('donations')}><Plus size={18}/> Add donation</button>}
            {user.role==='ngo'&&<button className="btn btn-primary" onClick={()=>changeTab('discover')}><Search size={17}/> Find food</button>}
            {user.role==='volunteer'&&<button className="btn btn-primary" onClick={()=>changeTab('tasks')}><Bike size={17}/> View tasks</button>}
          </div>
        </div>
        {tab==='overview'&&<Overview user={user} data={data} setTab={changeTab}/>}
        {tab==='donations'&&<DonorDonations user={user} data={data} toast={toast}/>}
        {tab==='requests'&&<Requests user={user} data={data} toast={toast}/>}
        {tab==='history'&&<HistoryPanel user={user} data={data}/>}
        {tab==='discover'&&<Discover user={user} data={data} toast={toast}/>}
        {tab==='deliveries'&&<Deliveries user={user} data={data} toast={toast}/>}
        {tab==='tasks'&&<Tasks user={user} data={data} toast={toast}/>}
        {tab==='map'&&<LiveLocation user={user} data={data} toast={toast}/>}
        {tab==='users'&&<AdminUsers data={data}/>}
      </main>
    </div>
  </div>;
}

function greeting(role){return role==='donor'?'Good to see you':role==='ngo'?'Welcome back':'Ready to make a difference';}
function welcomeText(role){return role==='donor'?'Your extra food can make someone’s day a little brighter.':role==='ngo'?'Find fresh food nearby and turn it into meaningful community support.':'Your next delivery can make a real difference in someone’s day.';}

function Overview({user,data,setTab}) {
  const donations = user.role==='admin'?data.donations:data.donations.filter(d=>d.donorEmail===user.id);
  const requests = user.role==='admin'?data.requests:data.requests.filter(r=>user.role==='donor'?r.donorEmail===user.id:r.ngoEmail===user.id);
  const assignments = user.role==='admin'?data.assignments:data.assignments.filter(a=>user.role==='volunteer'?a.volunteerEmail===user.id:a.ngoEmail===user.id);
  const stats = user.role==='donor'
    ? [['Food listings',donations.length,Utensils,'mint'],['Meals shared',donations.reduce((n,d)=>n+(d.servings||0),0),HeartHandshake,'peach'],['Pending requests',requests.filter(r=>r.status==='Pending').length,Clock3,'lavender']]
    : user.role==='ngo'
    ? [['Available food',data.donations.filter(d=>d.status==='Available').length,Utensils,'mint'],['My requests',requests.length,ClipboardList,'peach'],['Active deliveries',assignments.filter(a=>a.status!=='Delivered').length,Truck,'lavender']]
    : user.role==='volunteer'
    ? [['My assignments',assignments.length,Bike,'mint'],['In progress',assignments.filter(a=>a.status!=='Delivered').length,Truck,'peach'],['Delivered',assignments.filter(a=>a.status==='Delivered').length,CheckCircle2,'lavender']]
    : [['Food listings',data.donations.length,Utensils,'mint'],['Requests',data.requests.length,ClipboardList,'peach'],['Assignments',data.assignments.length,Truck,'lavender']];

  return <>
    <div className="stats-grid">{stats.map(([label,value,Icon,color])=><div className="stat-card" key={label}><div className={`stat-icon ${color}`}><Icon size={20}/></div><span>{label}</span><strong>{moneyless(value)}</strong></div>)}</div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Your community activity</h2></div><button className="text-link" onClick={()=>setTab(user.role==='volunteer'?'tasks':user.role==='ngo'?'requests':'history')}>View all <ArrowRight size={15}/></button></div>
        <ActivityList user={user} data={data}/>
      </section>
      <section className="panel impact-panel"><span className="eyebrow">FOODBRIDGE IMPACT</span><div className="impact-number">{moneyless(data.donations.reduce((n,d)=>n+(d.servings||0),0))}</div><h3>meal portions listed</h3><p>Every listing is an opportunity to reduce waste and support a community.</p><div className="impact-progress"><span style={{width:`${Math.min(100,data.donations.length*8)}%`}}/></div><small>{data.donations.length} food donations on the platform</small></section>
    </div>
  </>;
}

function ActivityList({user,data}) {
  const rows = [
    ...data.donations.filter(d=>user.role==='admin'||d.donorEmail===user.id).map(d=>({id:d.id,title:d.food,sub:`${d.quantity} · ${d.address}`,status:d.status,time:d.createdAt,icon:Utensils})),
    ...data.requests.filter(r=>user.role==='admin'||(user.role==='donor'?r.donorEmail===user.id:r.ngoEmail===user.id)).map(r=>({id:r.id,title:'Food request',sub:r.ngo||'Organisation request',status:r.status,time:r.createdAt,icon:ClipboardList}))
  ].sort((a,b)=>b.time-a.time).slice(0,5);

  return <div className="activity-list">{rows.map(row=><div className="activity-row" key={row.id}><span className="activity-icon"><row.icon size={17}/></span><div><b>{row.title}</b><small>{row.sub}</small></div><Status status={row.status}/><time>{timeAgo(row.time)}</time></div>)}{!rows.length&&<Empty title="Your activity will appear here" text="Once you list food or send a request, you will see updates here."/>}</div>;
}

function Status({status}) {
  const cls = String(status||'').toLowerCase().replaceAll(' ','-');
  return <span className={`status status-${cls}`}>{status||'Pending'}</span>;
}

function Empty({title,text,action}) {
  return <div className="empty-state"><div className="empty-icon"><HeartHandshake/></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function DonorDonations({user,data,toast}) {
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({food:'',category:'Cooked meals',quantity:'',servings:'',description:'',address:'',availableUntil:'',expiry:'',image:''});
  const [busy,setBusy]=useState(false);
  const mine=data.donations.filter(d=>d.donorId===user.id);
  const update=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit=async e=>{
    e.preventDefault();
    setBusy(true);
    try {
      await addDonation({...form,servings:Number(form.servings)||0,lat:null,lng:null});
      setForm({food:'',category:'Cooked meals',quantity:'',servings:'',description:'',address:'',availableUntil:'',expiry:'',image:''});
      setShow(false);
      toast('Your food donation is now listed!');
    } catch(err) {
      toast(err.message||'Could not publish donation.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <div className="section-toolbar">
      <div><h2>My donations</h2><p>Manage the food you have shared with your community.</p></div>
      <button className="btn btn-primary" onClick={()=>setShow(!show)}><Plus size={17}/>{show?'Close form':'Add a donation'}</button>
    </div>
    {show&&<form className="panel donation-form" onSubmit={submit}>
      <div className="form-title"><div><h3>Share some good food</h3><p>Tell your community what is available for pickup.</p></div><span className="form-emoji">🥗</span></div>
      <div className="form-grid">
        <label>Food name *<input required value={form.food} onChange={e=>update('food',e.target.value)} placeholder="e.g. Vegetable pulao"/></label>
        <label>Food category *<select value={form.category} onChange={e=>update('category',e.target.value)}><option>Cooked meals</option><option>Bakery</option><option>Fruits & vegetables</option><option>Packaged food</option><option>Dairy</option></select></label>
        <label>Quantity *<input required value={form.quantity} onChange={e=>update('quantity',e.target.value)} placeholder="e.g. 25 meal boxes"/></label>
        <label>Approx. servings<input type="number" min="0" value={form.servings} onChange={e=>update('servings',e.target.value)} placeholder="e.g. 25"/></label>
        <label className="span-two">Pickup address *<input required value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Street, area, city"/></label>
        <label>Available until *<input type="datetime-local" required value={form.availableUntil} onChange={e=>update('availableUntil',e.target.value)}/></label>
        <label>Expiry date<input type="date" value={form.expiry} onChange={e=>update('expiry',e.target.value)}/></label>
        <label className="span-two">Food image URL<input value={form.image} onChange={e=>update('image',e.target.value)} placeholder="Optional image URL"/></label>
        <label className="span-two">Description<textarea value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Add details about freshness, packaging or allergens."/></label>
      </div>
      <div className="form-footer"><small>* Required fields. Please only list safe, fresh food.</small><button className="btn btn-primary" disabled={busy}>{busy?'Publishing...':'Publish donation'} <ArrowRight size={16}/></button></div>
    </form>}
    <div className="donation-list">
      {mine.map(d=><div className="donation-row" key={d.id}><img src={d.image||'https://images.unsplash.com/photo-1547592180-85f173990554?w=400'} alt=""/><div className="donation-info"><b>{d.food}</b><small>{d.quantity} · {d.address}</small><small>Added {timeAgo(d.createdAt)}</small></div><Status status={d.status}/></div>)}
      {!mine.length&&<Empty title="Your donation story starts here" text="List surplus food and help it find a new home."/>}
    </div>
  </>;
}

function Requests({user,data,toast}) {
  const incoming=user.role==='donor'||user.role==='admin';
  const rows=data.requests.filter(r=>user.role==='admin'||(incoming?r.donorEmail===user.id:r.ngoEmail===user.id));
  const getDonation=r=>data.donations.find(d=>d.id===r.donationId);

  const changeStatus=async(id,status)=>{
    try {
      await updateRequest(id,status);
      toast(status==='Accepted'?'Request accepted! You can now coordinate a pickup.':'Request declined.');
    } catch(error) {
      toast(error.message||'Could not update the request.');
    }
  };

  return <>
    <div className="section-toolbar"><div><h2>{incoming?'Incoming requests':'My food requests'}</h2><p>{incoming?'Review organisations requesting your food.':'Follow the status of food requests sent by your organisation.'}</p></div></div>
    <div className="request-list">
      {rows.map(r=><div className="request-card" key={r.id}>
        <div className="request-card-top"><div><span className="eyebrow">{incoming?'NGO REQUEST':'FOOD REQUEST'}</span><h3>{getDonation(r)?.food||'Donation'}</h3><p>{incoming?`Requested by ${r.ngo}`:`Requested from ${getDonation(r)?.donor||'Food donor'}`}</p></div><Status status={r.status}/></div>
        <div className="request-message">“{r.message||'We would like to request this food donation.'}”</div>
        <div className="request-bottom">
          <span><Clock3 size={15}/>{timeAgo(r.createdAt)}</span>
          <span><MapPin size={15}/>{getDonation(r)?.address||'Pickup location'}</span>
          {incoming&&r.status==='Pending'&&<div className="request-actions">
            <button className="btn btn-outline small" onClick={()=>changeStatus(r.id,'Rejected')}>Decline</button>
            <button className="btn btn-primary small" onClick={()=>changeStatus(r.id,'Accepted')}>Accept request <CheckCircle2 size={15}/></button>
          </div>}
        </div>
      </div>)}
      {!rows.length&&<Empty title="No requests yet" text="Requests will appear here when an organisation or donor takes the next step."/>}
    </div>
  </>;
}

function Discover({user,data,toast}) {
  const [query,setQuery]=useState('');
  const [cat,setCat]=useState('All');
  const [selected,setSelected]=useState(null);
  const [message,setMessage]=useState('We would love to collect this food for our community.');
  const [busy,setBusy]=useState(false);
  const foods=data.donations.filter(d=>d.status==='Available'&&(d.food+' '+d.address+' '+d.donor).toLowerCase().includes(query.toLowerCase())&&(cat==='All'||d.category===cat));

  const request=async d=>{
    setBusy(true);
    try {
      await createRequest(d,user,message);
      setSelected(null);
      toast('Request sent to the donor!');
    } catch(e) {
      toast(e.message||'Could not send request.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <div className="section-toolbar"><div><h2>Discover available food</h2><p>Find fresh donations and request what your community needs.</p></div><span className="count-pill">{foods.length} available</span></div>
    <div className="filter-bar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search food or area"/></div><select value={cat} onChange={e=>setCat(e.target.value)}><option>All</option><option>Cooked meals</option><option>Bakery</option><option>Fruits & vegetables</option><option>Packaged food</option></select></div>
    <div className="food-grid-app">
      {foods.map(d=><article className="app-food-card" key={d.id}>
        <img src={d.image||'https://images.unsplash.com/photo-1547592180-85f173990554?w=800'} alt={d.food}/>
        <div className="app-food-content">
          <div className="food-card-top"><span className="food-tag-inline">{d.category}</span><span className="fresh-tag"><span/> Available</span></div>
          <h3>{d.food}</h3><p>{d.description}</p>
          <div className="app-food-meta"><span><Utensils/>{d.quantity}</span><span><MapPin/>{d.address}</span><span><Clock3/>{d.availableUntil}</span></div>
          <div className="app-food-bottom"><b>{d.donor}</b><button className="btn btn-primary small" onClick={()=>setSelected(d)}>Request food <ArrowRight size={15}/></button></div>
        </div>
      </article>)}
      {!foods.length&&<Empty title="No food matches that search" text="Try a different area or category, or check back shortly."/>}
    </div>
    {selected&&<div className="modal-backdrop" onClick={()=>!busy&&setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setSelected(null)}><X/></button>
      <span className="eyebrow">REQUEST A DONATION</span><h2>{selected.food}</h2><p className="muted">{selected.quantity} · {selected.address}</p>
      <label>Message to the donor<textarea value={message} onChange={e=>setMessage(e.target.value)}/></label>
      <button className="btn btn-primary full-btn" disabled={busy} onClick={()=>request(selected)}>{busy?'Sending...':'Send request'} <ArrowRight size={17}/></button>
    </div></div>}
  </>;
}

function Deliveries({user,data,toast}) {
  const reqs=data.requests.filter(r=>r.ngoEmail===user.id&&r.status==='Accepted');
  const volunteers=data.volunteers||[];
  const [selected,setSelected]=useState({});
  const [busy,setBusy]=useState({});
  const [error,setError]=useState('');

  const assign=async(request,donation)=>{
    const volunteer=volunteers.find(v=>v.id===selected[request.id]);
    if(!volunteer) {
      setError('Select a registered volunteer before assigning this pickup.');
      return;
    }
    setError('');
    setBusy(p=>({...p,[request.id]:true}));
    try {
      await assignVolunteer(request,donation,volunteer);
      toast(`${volunteer.full_name||'Volunteer'} assigned successfully.`);
    } catch(e) {
      setError(e.message||'Could not assign volunteer.');
    } finally {
      setBusy(p=>({...p,[request.id]:false}));
    }
  };

  return <>
    <div className="section-toolbar"><div><h2>Delivery coordination</h2><p>Assign a registered volunteer to each accepted food donation.</p></div></div>
    {error&&<div className="form-error"><AlertCircle size={16}/>{error}</div>}
    <div className="delivery-list">
      {reqs.map(r=>{
        const d=data.donations.find(x=>x.id===r.donationId);
        const assignment=data.assignments.find(a=>a.requestId===r.id);
        return <div className="delivery-card" key={r.id}>
          <div><span className="eyebrow">ACCEPTED DONATION</span><h3>{d?.food||'Food donation'}</h3><p>{d?.donor} · {d?.address}</p></div>
          {assignment
            ? <div><Status status={assignment.status}/><p>{assignment.volunteer}</p></div>
            : <div className="delivery-assign">
                <select value={selected[r.id]||''} onChange={e=>setSelected(p=>({...p,[r.id]:e.target.value}))}>
                  <option value="">Select registered volunteer</option>
                  {volunteers.map(v=><option key={v.id} value={v.id}>{v.full_name}</option>)}
                </select>
                <button className="btn btn-primary small" disabled={Boolean(busy[r.id])||!volunteers.length} onClick={()=>assign(r,d)}>
                  {busy[r.id]?'Assigning...':'Assign volunteer'} <Bike size={15}/>
                </button>
              </div>}
        </div>;
      })}
      {!reqs.length&&<Empty title="No accepted donations to coordinate" text="Once a donor accepts one of your requests, you can assign a registered volunteer here."/>}
      {reqs.length>0&&!volunteers.length&&<Empty title="No registered volunteers found" text="A volunteer must create a FoodBridge account before an NGO can assign them to a pickup."/>}
    </div>
  </>;
}

function Tasks({user,data,toast}) {
  const tasks=data.assignments.filter(a=>user.role==='admin'||a.volunteerEmail===user.id);
  const [busy,setBusy]=useState({});
  const move=async(a,status)=>{
    setBusy(p=>({...p,[a.id]:true}));
    try {
      await updateAssignment(a.id,status);
      toast(`Task updated: ${status}.`);
    } catch(error) {
      toast(error.message||'Could not update task.');
    } finally {
      setBusy(p=>({...p,[a.id]:false}));
    }
  };

  return <>
    <div className="section-toolbar"><div><h2>My assignments</h2><p>Every pickup is a chance to make someone's day better.</p></div><span className="count-pill">{tasks.length} tasks</span></div>
    <div className="task-list">
      {tasks.map(a=><div className="task-card" key={a.id}>
        <div className="task-card-head"><div className="task-icon"><Bike/></div><div><span className="eyebrow">FOOD PICKUP</span><h3>{data.donations.find(d=>d.id===a.donationId)?.food||'Food collection'}</h3><p>{a.donor} → {a.ngo}</p></div><Status status={a.status}/></div>
        <div className="task-details"><span><MapPin/>{a.address}</span><span><Clock3/>Assigned {timeAgo(a.createdAt)}</span></div>
        <div className="task-actions">
          {a.status==='Assigned'&&<button className="btn btn-outline small" disabled={busy[a.id]} onClick={()=>move(a,'Picked up')}>Mark picked up</button>}
          {a.status==='Picked up'&&<button className="btn btn-primary small" disabled={busy[a.id]} onClick={()=>move(a,'In transit')}>Start delivery <Truck size={15}/></button>}
          {a.status==='In transit'&&<button className="btn btn-primary small" disabled={busy[a.id]} onClick={()=>move(a,'Delivered')}>Confirm delivered <CheckCircle2 size={15}/></button>}
          {a.status==='Delivered'&&<span className="completed-note"><CheckCircle2 size={16}/> Delivery completed. Thank you!</span>}
          <button className="text-link" onClick={()=>toast(`Pickup: ${a.address}. Destination: ${a.ngo}.`)}>View details <ArrowRight size={15}/></button>
        </div>
      </div>)}
      {!tasks.length&&<Empty title="No assignments yet" text="When an NGO assigns a pickup to you, it will appear here."/>}
    </div>
  </>;
}

function TaskList({tasks}) {
  return tasks.length?<div className="activity-list">{tasks.map(t=><div className="activity-row" key={t.id}><span className="activity-icon"><Bike size={17}/></span><div><b>{t.donor} → {t.ngo}</b><small>{t.address}</small></div><Status status={t.status}/></div>)}</div>:<Empty title="No assignments yet" text="Your volunteer tasks will appear here."/>;
}

function HistoryPanel({user,data}) {
  const rows=user.role==='donor'
    ? data.donations.filter(d=>d.donorId===user.id&&d.status==='Delivered')
    : user.role==='volunteer'
    ? data.assignments.filter(a=>a.volunteerEmail===user.id&&a.status==='Delivered')
    : data.requests.filter(r=>r.ngoEmail===user.id&&r.status==='Accepted');

  return <>
    <div className="section-toolbar"><div><h2>{user.role==='volunteer'?'Delivery history':user.role==='donor'?'Donation history':'Received food history'}</h2><p>A record of the good that has made it all the way through.</p></div></div>
    {rows.length?<div className="history-list">{rows.map(r=><div className="history-row" key={r.id}><span className="history-check"><CheckCircle2/></span><div><b>{r.food||data.donations.find(d=>d.id===r.donationId)?.food||'Food handoff'}</b><small>{r.address||'FoodBridge community'}</small></div><Status status="Completed"/></div>)}</div>:<Empty title="Your history is just getting started" text="Completed donations and deliveries will be saved here."/>}
  </>;
}

function LiveLocation({user,data,toast}) {
  const [position,setPosition]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const update=async()=>{
    setBusy(true);
    setError('');
    try {
      const p=await getCurrentPosition();
      setPosition(p);
      toast('Your current location was captured in this browser session.');
    } catch(e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return <>
    <div className="section-toolbar"><div><h2>Live location</h2><p>Share your current position when coordinating a pickup.</p></div><button className="btn btn-primary" onClick={update} disabled={busy}>{busy?<RefreshCw className="spin"/>:<Navigation size={17}/>} {busy?'Locating...':'Use my current location'}</button></div>
    <div className="panel location-panel">
      <div className="location-illustration"><MapPinned size={42}/><h3>{position?'Location captured':'Your location, on your terms'}</h3><p>{position?`Latitude ${position.lat.toFixed(5)} · Longitude ${position.lng.toFixed(5)} · Accuracy about ${Math.round(position.accuracy)}m`:'Allow browser location access to capture your current GPS coordinates. This does not continuously broadcast your location.'}</p>{error&&<div className="form-error"><AlertCircle size={16}/>{error}</div>}{position&&<a className="text-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=16/${position.lat}/${position.lng}`}>Open location on map <ArrowRight size={15}/></a>}</div>
      <div className="location-privacy"><ShieldCheck/><span><b>Your privacy matters</b><small>Location is requested only when you press the button. Continuous background tracking is not enabled.</small></span></div>
    </div>
  </>;
}

function AdminUsers({data}) {
  const users=data.users||[];
  return <>
    <div className="section-toolbar"><div><h2>Community overview</h2><p>Registered FoodBridge accounts and platform activity.</p></div></div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon"><Users/></div><span>Registered accounts</span><strong>{users.length}</strong></div>
      <div className="stat-card"><div className="stat-icon"><Utensils/></div><span>Food listings</span><strong>{data.donations.length}</strong></div>
      <div className="stat-card"><div className="stat-icon"><Truck/></div><span>Assignments</span><strong>{data.assignments.length}</strong></div>
    </div>
    <div className="panel"><h3>FoodBridge community accounts</h3><div className="admin-user-list">
      {users.map(u=><div key={u.id}><span className="user-avatar">{(u.full_name||'U')[0]}</span><span><b>{u.full_name}</b><small>{u.organisation||u.role}</small></span><Status status={roleNames[u.role]||u.role}/></div>)}
      {!users.length&&<Empty title="No accounts found" text="Registered profiles will appear here when they are available to the administrator."/>}
    </div></div>
  </>;
}

export default App;